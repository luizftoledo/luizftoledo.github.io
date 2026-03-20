#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile


PASSWORD = "toledo"
ITERATIONS = 250_000
ROOT = pathlib.Path(__file__).resolve().parent
REPORT_DIR = pathlib.Path("/Users/luizfernandotoledo/jmail_brazil_report")

SUMMARY_PATH = REPORT_DIR / "epstein_brazil_summary.json"
GRAPH_PATH = REPORT_DIR / "epstein_brazil_graph_data.json"
OVERVIEW_PATH = REPORT_DIR / "epstein_brazil_overview.md"
PAYLOAD_PATH = ROOT / "payload.js"

EPSTEIN_NODE_ID = "person:jeffrey-epstein"


def load_json(path: pathlib.Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def keep_graph_subset(summary: dict, graph: dict) -> dict:
    nodes = graph["nodes"]
    edges = graph["edges"]
    direct_map = {row["node_id"]: row for row in summary["direct_people"]}
    second_map = {row["node_id"]: row for row in summary["second_degree_people"]}

    curated_labels = {
        "Daniel Sabba",
        "Vahe Stepanian",
        "Paul Morris",
        "Richard Kahn",
        "Ariane Dwyer",
        "Lesley Groff",
        "Valdson Cotrin",
        "Boris Nikolic",
        "David Stern",
        "Dr Jose roberto",
        "Elen Capri",
        "Cirlei Santos",
        "Livia Goncalves",
        "José Leal",
    }

    keep = {EPSTEIN_NODE_ID}

    for node_id, node in nodes.items():
        if node["node_class"] == "topic":
            keep.add(node_id)
            continue
        if node_id in second_map:
            keep.add(node_id)
            continue
        row = direct_map.get(node_id)
        if not row:
            continue
        if (
            int(row["threads"]) >= 80
            or row["likely_brazilian"]
            or row["brazil_linked_person_seed"]
            or row["label"] in curated_labels
        ):
            keep.add(node_id)

    for edge in edges:
        if edge["source"] in second_map and nodes[edge["target"]]["node_class"] == "person":
            keep.add(edge["target"])
        if edge["target"] in second_map and nodes[edge["source"]]["node_class"] == "person":
            keep.add(edge["source"])

    filtered_edges = []
    for edge in edges:
        if edge["source"] not in keep or edge["target"] not in keep:
            continue
        source_node = nodes[edge["source"]]
        target_node = nodes[edge["target"]]

        if source_node["node_class"] == "topic" or target_node["node_class"] == "topic":
            filtered_edges.append(edge)
            continue

        if EPSTEIN_NODE_ID in {edge["source"], edge["target"]}:
            filtered_edges.append(edge)
            continue

        if edge["source"] in second_map or edge["target"] in second_map:
            filtered_edges.append(edge)
            continue

        if edge["type"] in {"jacebook_preview", "jacebook_like"}:
            filtered_edges.append(edge)
            continue

        if edge["type"] == "email_thread" and edge.get("weight", 0) >= 12:
            filtered_edges.append(edge)

    used_nodes = set()
    for edge in filtered_edges:
        used_nodes.add(edge["source"])
        used_nodes.add(edge["target"])

    filtered_nodes = {
        node_id: node
        for node_id, node in nodes.items()
        if node_id in used_nodes or node_id == EPSTEIN_NODE_ID
    }

    return {
        "nodes": filtered_nodes,
        "edges": filtered_edges,
    }


def make_bundle(summary: dict, graph: dict, overview_md: str) -> dict:
    direct_people = summary["direct_people"]
    second_degree_people = summary["second_degree_people"]

    graph_subset = keep_graph_subset(summary, graph)

    highlights = [
        {
            "title": "Cluster financeiro Brasil",
            "body": (
                "O núcleo mais denso liga Jeffrey Epstein a Daniel Sabba, Vahe Stepanian, "
                "Paul Morris, Richard Kahn e Ariane Dwyer em operações de Brazil CDS e Petrobras, "
                "sobretudo entre 2015 e 2016."
            ),
            "contacts": ["Daniel Sabba", "Vahe Stepanian", "Paul Morris", "Richard Kahn", "Ariane Dwyer"],
        },
        {
            "title": "Logística e viagens",
            "body": (
                "Valdson Cotrin aparece como o principal elo brasileiro por volume, cercado por Lesley Groff, "
                "Bella Klein e Boris Nikolic em mensagens sobre voos, retorno ao Brasil, números locais e rotinas."
            ),
            "contacts": ["Valdson Cotrin", "Lesley Groff", "Boris Nikolic", "Bella Klein"],
        },
        {
            "title": "Núcleo São Paulo",
            "body": (
                "Ana Maria Macedo conecta um bloco paulista de segundo grau com Adriana Lima, Catia Macedo, "
                "Daniel Macedo e outros endereços .com.br, enquanto Jeffrey aparece em mensagens de 2006 "
                "pedindo ligação no Brasil e mencionando ida a São Paulo."
            ),
            "contacts": ["Ana Maria Macedo", "ADRIANA LIMA", "Catia Macedo", "Daniel Macedo"],
        },
        {
            "title": "Projetos e oportunidades no Brasil",
            "body": (
                "David Stern serve de ponte para um mini-cluster envolvendo Livia Goncalves, José Leal e "
                "Cirlei Santos em material sobre operação florestal no Brasil."
            ),
            "contacts": ["David Stern", "Livia Goncalves", "José Leal", "Cirlei Santos"],
        },
        {
            "title": "Núcleo médico em São Paulo",
            "body": (
                "Em 10 de julho de 2017, Jeffrey pede indicação para cirurgia de mama em São Paulo e recebe "
                "o contato de Dr Jose roberto por WhatsApp."
            ),
            "contacts": ["Dr Jose roberto"],
        },
    ]

    source_threads = [
        {
            "title": "Brazil trade idea",
            "date": "March 28, 2016",
            "url": "https://jmail.world/thread/EFTA01477762?view=inbox",
            "summary": "Discussão financeira com Brazil 5yr CDS e Petrobras, conectando Daniel Sabba, Richard Kahn e Vahe Stepanian.",
        },
        {
            "title": "Contact in brasil",
            "date": "March 24, 2015",
            "url": "https://jmail.world/thread/EFTA02151003?view=inbox",
            "summary": "Coordenação prática envolvendo Valdson Cotrin e Lesley Groff durante estadia no Brasil.",
        },
        {
            "title": "Valdson return flight to Paris from Brasil",
            "date": "March 24, 2015",
            "url": "https://jmail.world/thread/EFTA01907661?view=inbox",
            "summary": "Logística de retorno de Valdson do Brasil a Paris em caixa ligada ao Epstein.",
        },
        {
            "title": "Re: Brazil",
            "date": "October 23, 2017",
            "url": "https://jmail.world/thread/EFTA02343664?view=inbox",
            "summary": "David Stern pressiona Jeffrey em torno de uma agenda ou operação descrita apenas como “Brazil”.",
        },
        {
            "title": "SAVE THE DATE",
            "date": "March 30, 2008",
            "url": "https://jmail.world/thread/62347214909e7c990642986e276a6eb2?view=inbox",
            "summary": "Email de Ana Maria Macedo com grande lista de contatos paulistas e endereço em Vila Olímpia, São Paulo.",
        },
        {
            "title": "(no subject) / tropical forest operation in Brasil",
            "date": "February 4, 2011",
            "url": "https://jmail.world/thread/vol00009-efta00645982-pdf?view=inbox",
            "summary": "David Stern encaminha a Jeffrey material sobre operação florestal no Brasil envolvendo Livia Goncalves e José Leal.",
        },
        {
            "title": "(no subject) / Dr Jose roberto",
            "date": "July 10, 2017",
            "url": "https://jmail.world/thread/EFTA02384939?view=inbox",
            "summary": "Contato por WhatsApp de Dr Jose roberto após Jeffrey pedir indicação em São Paulo.",
        },
    ]

    return {
        "meta": {
            "title": "Epstein-Brazil Dossier",
            "generated_at": "2026-03-20",
            "report_scope": "Jmail/Jacebook public endpoints; graph limited to two degrees from Jeffrey Epstein.",
            "full_graph_node_count": summary["node_count"],
            "full_graph_edge_count": summary["edge_count"],
            "web_graph_node_count": len(graph_subset["nodes"]),
            "web_graph_edge_count": len(graph_subset["edges"]),
            "thread_failures": len(summary.get("thread_failures", [])),
        },
        "stats": {
            "threads": 5431,
            "direct_people": summary["direct_people_count"],
            "second_degree_people": summary["second_degree_people_count"],
            "full_nodes": summary["node_count"],
            "full_edges": summary["edge_count"],
        },
        "categories": summary["category_counter"],
        "years": summary["year_counter"],
        "highlights": highlights,
        "source_threads": source_threads,
        "overview_markdown": overview_md,
        "direct_people": direct_people,
        "second_degree_people": second_degree_people,
        "graph": graph_subset,
    }


def encrypt_bundle(bundle: dict) -> dict:
    raw = json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    salt = os.urandom(16)
    iv = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", PASSWORD.encode("utf-8"), salt, ITERATIONS, dklen=32)

    with tempfile.TemporaryDirectory() as tmp_dir_name:
        tmp_dir = pathlib.Path(tmp_dir_name)
        plain_path = tmp_dir / "bundle.json"
        cipher_path = tmp_dir / "bundle.enc"
        plain_path.write_bytes(raw)
        subprocess.run(
            [
                "openssl",
                "enc",
                "-aes-256-cbc",
                "-K",
                key.hex(),
                "-iv",
                iv.hex(),
                "-in",
                str(plain_path),
                "-out",
                str(cipher_path),
            ],
            check=True,
        )
        ciphertext = cipher_path.read_bytes()

    return {
        "iterations": ITERATIONS,
        "salt_b64": base64.b64encode(salt).decode("ascii"),
        "iv_b64": base64.b64encode(iv).decode("ascii"),
        "ciphertext_b64": base64.b64encode(ciphertext).decode("ascii"),
    }


def main() -> None:
    summary = load_json(SUMMARY_PATH)
    graph = load_json(GRAPH_PATH)
    overview_md = load_text(OVERVIEW_PATH)

    bundle = make_bundle(summary, graph, overview_md)
    payload = encrypt_bundle(bundle)

    PAYLOAD_PATH.write_text(
        "window.EPSTEIN_BRAZIL_DOSSIER = " + json.dumps(payload, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {PAYLOAD_PATH}")


if __name__ == "__main__":
    main()
