#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import fitz
import spacy
from pypdf import PdfReader
from spacy.lang.pt.stop_words import STOP_WORDS


OCR_TRANSLATION = str.maketrans(
    {
        "Ɵ": "ti",
        "İ": "fi",
        "Ʃ": "tt",
        "ơ": "tí",
        "ƞ": "nt",
        "ﬁ": "fi",
        "ﬂ": "fl",
        "ﬀ": "ff",
    }
)

PART_RE = re.compile(r"^(PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA|QUINTA)\s+PARTE\s+—\s+(.+)$")
BOOK_RE = re.compile(r"^LIVRO\s+(.+?)\s+—\s+(.+)$")
CHAPTER_RE = re.compile(r"^([IVXLCDM]+)\s+—\s*(.+)$")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…»])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ«—])")
TOKEN_RE = re.compile(r"[a-zà-ÿ0-9]+", re.IGNORECASE)
META_SENTENCE_PATTERNS = [
    "embora seja estranho ao enredo",
    "não será demais referir",
    "não será inútil",
    "como já dissemos",
    "como dissemos",
    "já o dissemos",
    "digamo-lo de passagem",
    "é preciso dizer",
    "é necessário dizer",
    "convém notar",
    "cumpre notar",
    "não esqueçamos",
]

GENERIC_ADJECTIVE_STOPLIST = {
    "mesmo",
    "tão",
    "todo",
    "toda",
    "todas",
    "todos",
    "algum",
    "alguma",
    "alguns",
    "algumas",
    "outro",
    "outra",
    "outras",
    "outros",
    "pouco",
    "muito",
    "muita",
    "muitas",
    "muitos",
    "primeiro",
    "primeira",
    "último",
    "última",
    "novo",
    "nova",
    "novos",
    "novas",
    "mesma",
    "mesmas",
    "mesmos",
    "certo",
    "certa",
    "certos",
    "certas",
    "diverso",
    "diversa",
    "diversos",
    "diversas",
    "próprio",
    "própria",
    "próprios",
    "próprias",
    "proprio",
    "propria",
    "proprios",
    "proprias",
    "seguinte",
    "único",
    "unico",
    "chamado",
    "ótimo",
    "otimo",
    "ótima",
    "otima",
    "vira",
    "verdadeiro",
    "verdadeira",
    "verdadeiros",
    "verdadeiras",
    "presente",
    "liberto",
    "chegada",
    "fito",
}

GENERIC_DESCRIPTOR_NOUN_STOPLIST = {
    "especie",
    "caracter",
    "classe",
    "homem",
    "mulher",
    "pai",
    "mae",
    "filho",
    "filha",
    "familia",
    "crianca",
    "rapaz",
    "rapariga",
    "mancebo",
    "pessoa",
    "senhor",
    "senhora",
    "nome",
    "modo",
    "parte",
    "caso",
    "ponto",
    "fundo",
    "alma",
    "olho",
}

HONORIFIC_TOKENS = {
    "senhor",
    "senhora",
    "monsieur",
    "madame",
    "sr",
    "sra",
    "maire",
    "abade",
    "monsenhor",
    "bispo",
    "irma",
    "irmao",
}

DESCRIPTOR_COPULAR_VERBS = {
    "ser",
    "parecer",
    "ficar",
    "permanecer",
    "tornar",
    "continuar",
}

PREDICATE_DESCRIPTOR_NOUN_ALLOWLIST = {
    "inimigo",
    "inocencia",
    "lutador",
    "luz",
    "malvado",
    "orfa",
    "terror",
    "velhaco",
    "viuvo",
    "gaiato",
    "folgazao",
}

BLOCKED_DESCRIPTOR_DEPS = {
    "advcl",
    "appos",
    "aux",
    "aux:pass",
    "ccomp",
    "csubj",
    "iobj",
    "mark",
    "nsubj",
    "nsubj:pass",
    "obj",
    "obl:agent",
    "parataxis",
    "xcomp",
}

APPOSITIVE_PUNCT = {",", "—", "-", "–", "(", ")"}

CHARACTERS = {
    "Jean Valjean": [
        "jean valjean",
        "valjean",
        "madelaine",
        "madeleine",
        "senhor madelaine",
        "senhor madeleine",
        "monsieur madeleine",
        "monsieur madelaine",
        "senhor leblanc",
    ],
    "Mário": ["mário", "mario", "mário pontmercy", "mario pontmercy"],
    "Cosette": ["cosette"],
    "Javert": ["javert"],
    "Thenardier": ["thenardier", "thénardier"],
    "Bispo Myriel": [
        "myriel",
        "abade myriel",
        "monsenhor bemvindo",
        "carlos myriel",
        "bemvindo",
    ],
    "Gavroche": ["gavroche"],
    "Fantine": ["fantine"],
    "Gillenormand": ["gillenormand"],
    "Enjolras": ["enjolras"],
    "Fauchelevent": ["fauchelevent"],
    "Eponina": ["eponina", "eponine"],
    "Mabeuf": ["mabeuf"],
    "Courfeyrac": ["courfeyrac"],
    "Combeferre": ["combeferre"],
    "Grantaire": ["grantaire"],
    "Joly": ["joly"],
    "Bossuet": ["bossuet"],
    "Bahorel": ["bahorel"],
    "Montparnasse": ["montparnasse"],
    "Toussaint": ["toussaint"],
    "Irmã Simplícia": ["irmã simplícia", "irma simplicia", "irmã simplicia"],
    "Tholomyés": ["tholomyés", "tholomyes"],
}

CITY_PLACES = [
    {"name": "Paris", "aliases": ["paris"], "lat": 48.8566, "lon": 2.3522},
    {"name": "Arras", "aliases": ["arras"], "lat": 50.291, "lon": 2.7775},
    {"name": "Waterloo", "aliases": ["waterloo"], "lat": 50.715, "lon": 4.3997},
    {"name": "Montreuil-sur-Mer", "aliases": ["montreuil", "montreuil-sur-mer"], "lat": 50.4654, "lon": 1.7632},
    {"name": "Digne", "aliases": ["digne"], "lat": 44.0925, "lon": 6.2318},
    {"name": "Luxemburgo", "aliases": ["luxemburgo"], "lat": 48.8462, "lon": 2.3372},
    {"name": "Picpus", "aliases": ["picpus", "petit-picpus"], "lat": 48.8444, "lon": 2.3942},
    {"name": "Austerlitz", "aliases": ["austerlitz"], "lat": 48.8421, "lon": 2.3662},
    {"name": "Toulon", "aliases": ["toulon"], "lat": 43.1242, "lon": 5.928},
    {"name": "Montfermeil", "aliases": ["montfermeil"], "lat": 48.8991, "lon": 2.579},
    {"name": "Vernon", "aliases": ["vernon"], "lat": 49.0929, "lon": 1.4633},
    {"name": "Bruxelas", "aliases": ["bruxelas"], "lat": 50.8503, "lon": 4.3517},
    {"name": "Londres", "aliases": ["londres"], "lat": 51.5072, "lon": -0.1276},
    {"name": "Pontarlier", "aliases": ["pontarlier"], "lat": 46.9062, "lon": 6.3558},
]

SETTINGS = [
    {
        "name": "Digne e a casa do bispo",
        "aliases": ["digne", "paço episcopal", "palácio episcopal", "hospital"],
        "type": "cidade",
    },
    {
        "name": "Galés de Toulon",
        "aliases": ["toulon", "forçado", "forçados", "galés", "grilheta"],
        "type": "prisão",
    },
    {
        "name": "Montreuil-sur-Mer e a fábrica",
        "aliases": ["montreuil", "fábrica", "maire", "senhor madelaine"],
        "type": "cidade",
    },
    {
        "name": "Montfermeil e a estalagem dos Thenardier",
        "aliases": ["montfermeil", "estalagem", "albergue", "venda"],
        "type": "cidade",
    },
    {
        "name": "Convento de Petit-Picpus",
        "aliases": ["petit-picpus", "picpus", "convento", "freiras"],
        "type": "convento",
    },
    {
        "name": "Jardim do Luxemburgo",
        "aliases": ["luxemburgo", "jardim", "alameda"],
        "type": "jardim",
    },
    {
        "name": "Rua Plumet",
        "aliases": ["rua plumet", "plumet"],
        "type": "rua",
    },
    {
        "name": "Barricada do Corinto",
        "aliases": ["barricada", "corinto", "café", "canhões"],
        "type": "barricada",
    },
    {
        "name": "Esgotos de Paris",
        "aliases": ["esgoto", "esgotos", "cloaca", "canos"],
        "type": "subsolo",
    },
    {
        "name": "Tribunal de Arras",
        "aliases": ["arras", "tribunal", "champmathieu"],
        "type": "tribunal",
    },
    {
        "name": "Waterloo",
        "aliases": ["waterloo", "hougomont", "mont-saint-jean", "campo de batalha"],
        "type": "batalha",
    },
]


@dataclass
class TocEntry:
    kind: str
    title: str
    page: int


def clean_text(text: str) -> str:
    text = text.translate(OCR_TRANSLATION)
    text = unicodedata.normalize("NFKC", text.replace("\x00", " "))
    text = re.sub(r"\s*—\s*", " — ", text)
    return text


def collapse_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def strip_accents(text: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", text) if unicodedata.category(char) != "Mn"
    )


def normalize_search(text: str) -> str:
    text = strip_accents(collapse_spaces(clean_text(text)).lower())
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(normalize_search(text))


def compile_alias_pattern(aliases: list[str]) -> re.Pattern[str]:
    normalized = [re.escape(normalize_search(alias)) for alias in aliases]
    return re.compile(r"\b(?:" + "|".join(normalized) + r")\b")


def split_sentences(text: str) -> list[str]:
    raw_sentences = SENTENCE_SPLIT_RE.split(collapse_spaces(text))
    return [sentence.strip() for sentence in raw_sentences if len(sentence.strip()) >= 35]


def shorten(text: str, limit: int = 240) -> str:
    text = collapse_spaces(text)
    if len(text) <= limit:
        return text
    clipped = text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:")
    return f"{clipped}…"


def join_labels(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} e {items[1]}"
    return f"{', '.join(items[:-1])} e {items[-1]}"


def classify_toc_entry(title: str) -> str:
    if title in {"ÍNDICE", "NOTAS"}:
        return "other"
    if PART_RE.match(title):
        return "part"
    if BOOK_RE.match(title):
        return "book"
    if CHAPTER_RE.match(title):
        return "chapter"
    return "other"


def load_toc(pdf_path: Path) -> list[TocEntry]:
    document = fitz.open(pdf_path)
    entries: list[TocEntry] = []
    for _, raw_title, page_num, _meta in document.get_toc(simple=False):
        if page_num < 13:
            continue
        title = collapse_spaces(clean_text(raw_title))
        kind = classify_toc_entry(title)
        if kind == "other":
            continue
        entries.append(TocEntry(kind=kind, title=title, page=page_num - 1))
    return entries


def load_pages(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    return [clean_text(page.extract_text() or "") for page in reader.pages]


def slice_page(page_text: str, marker: str, keep_after: bool) -> str:
    if not marker:
        return page_text
    collapsed = collapse_spaces(page_text)
    position = collapsed.find(marker)
    if position == -1:
        position = collapsed.find(marker[: min(len(marker), 80)])
    if position == -1:
        return collapsed
    if keep_after:
        return collapsed[position + len(marker) :].strip()
    return collapsed[:position].strip()


def build_chapters(entries: list[TocEntry], pages: list[str]) -> tuple[list[dict], list[dict], list[dict]]:
    parts: list[dict] = []
    books: list[dict] = []
    chapters: list[dict] = []

    current_part: dict | None = None
    current_book: dict | None = None
    part_index = 0
    book_index = 0
    chapter_index = 0

    for index, entry in enumerate(entries):
        if entry.kind == "part":
            part_index += 1
            current_part = {
                "id": f"part-{part_index}",
                "title": entry.title,
                "page_start": entry.page + 1,
                "book_ids": [],
            }
            parts.append(current_part)
            continue

        if entry.kind == "book":
            book_index += 1
            current_book = {
                "id": f"book-{book_index:02d}",
                "title": entry.title,
                "page_start": entry.page + 1,
                "part_id": current_part["id"] if current_part else None,
                "chapter_ids": [],
            }
            books.append(current_book)
            if current_part:
                current_part["book_ids"].append(current_book["id"])
            continue

        if entry.kind != "chapter":
            continue

        next_title = ""
        next_page = len(pages) - 1
        for future in entries[index + 1 :]:
            if future.kind in {"chapter", "book", "part"}:
                next_title = future.title
                next_page = future.page
                break

        chapter_pages: list[str] = []
        for page_index in range(entry.page, next_page + 1):
            page_text = pages[page_index]
            if page_index == entry.page:
                page_text = slice_page(page_text, entry.title, keep_after=True)
            if page_index == next_page and next_title:
                page_text = slice_page(page_text, next_title, keep_after=False)
            page_text = collapse_spaces(page_text)
            if page_text:
                chapter_pages.append(page_text)

        match = CHAPTER_RE.match(entry.title)
        if not match:
            continue

        roman, title = match.groups()
        chapter_index += 1
        chapter_id = f"chapter-{chapter_index:03d}"
        text = collapse_spaces(" ".join(chapter_pages))
        chapter = {
            "id": chapter_id,
            "seq": chapter_index,
            "roman": roman,
            "title": title,
            "full_title": entry.title,
            "part_id": current_part["id"] if current_part else None,
            "part_title": current_part["title"] if current_part else "",
            "book_id": current_book["id"] if current_book else None,
            "book_title": current_book["title"] if current_book else "",
            "page_start": entry.page + 1,
            "page_end": next_page + 1,
            "text": text,
            "search_text": normalize_search(text),
            "sentences": split_sentences(text),
        }
        chapters.append(chapter)
        if current_book:
            current_book["chapter_ids"].append(chapter_id)

    return parts, books, chapters


def extract_character_stats(chapters: list[dict]) -> tuple[list[dict], dict[str, re.Pattern[str]]]:
    patterns = {name: compile_alias_pattern(aliases) for name, aliases in CHARACTERS.items()}

    for chapter in chapters:
        counts = {}
        for name, pattern in patterns.items():
            match_count = len(pattern.findall(chapter["search_text"]))
            if match_count:
                counts[name] = match_count
        chapter["character_counts"] = counts

    stats = []
    for name in CHARACTERS:
        mentions = sum(chapter["character_counts"].get(name, 0) for chapter in chapters)
        coverage = sum(1 for chapter in chapters if chapter["character_counts"].get(name, 0))
        part_coverage = len(
            {
                chapter["part_id"]
                for chapter in chapters
                if chapter["character_counts"].get(name, 0)
            }
        )
        stats.append(
            {
                "name": name,
                "mentions": mentions,
                "chapterCoverage": coverage,
                "partCoverage": part_coverage,
                "aliases": CHARACTERS[name],
            }
        )

    stats.sort(key=lambda item: (-item["mentions"], -item["chapterCoverage"], item["name"]))
    for index, item in enumerate(stats):
        if index < 6:
            tier = "principal"
        elif index < 14:
            tier = "secundário"
        else:
            tier = "apoio"
        item["tier"] = tier

    return stats, patterns


def extract_place_stats(chapters: list[dict], place_definitions: list[dict], key: str) -> list[dict]:
    patterns = {
        item["name"]: compile_alias_pattern(item["aliases"]) for item in place_definitions
    }

    stats = []
    for item in place_definitions:
        name = item["name"]
        mentions = 0
        coverage = 0
        sample = ""
        part_coverage = set()
        part_counts: Counter[str] = Counter()
        part_mentions: Counter[str] = Counter()
        best_chapter: dict | None = None
        examples = []
        seen_examples = set()
        for chapter in chapters:
            count = len(patterns[name].findall(chapter["search_text"]))
            if count:
                mentions += count
                coverage += 1
                part_coverage.add(chapter["part_id"])
                part_counts[chapter["part_title"]] += 1
                part_mentions[chapter["part_title"]] += count
                sentence = find_sentence(chapter["sentences"], patterns[name])
                if not sample:
                    sample = sentence
                if best_chapter is None or count > best_chapter["mentions"]:
                    best_chapter = {
                        "chapterId": chapter["id"],
                        "chapterTitle": chapter["full_title"],
                        "partTitle": chapter["part_title"],
                        "bookTitle": chapter["book_title"],
                        "pageStart": chapter["page_start"],
                        "pageEnd": chapter["page_end"],
                        "mentions": count,
                    }
                excerpt = shorten(sentence, 320)
                normalized_excerpt = normalize_search(excerpt)
                if len(examples) < 3 and normalized_excerpt not in seen_examples:
                    seen_examples.add(normalized_excerpt)
                    examples.append(
                        {
                            "chapterId": chapter["id"],
                            "chapterTitle": chapter["full_title"],
                            "partTitle": chapter["part_title"],
                            "bookTitle": chapter["book_title"],
                            "pageStart": chapter["page_start"],
                            "pageEnd": chapter["page_end"],
                            "mentions": count,
                            "excerpt": excerpt,
                        }
                    )
        result = dict(item)
        result[key] = mentions
        result["chapterCoverage"] = coverage
        result["partCoverage"] = len(part_coverage)
        result["topParts"] = [
            {
                "title": title,
                "chapters": part_counts[title],
                "mentions": part_mentions[title],
            }
            for title, _ in sorted(
                part_mentions.items(),
                key=lambda pair: (-pair[1], -part_counts[pair[0]], pair[0]),
            )[:2]
        ]
        result["peakChapter"] = best_chapter
        result["examples"] = examples
        result["excerpt"] = shorten(sample) if sample else ""
        stats.append(result)

    stats.sort(key=lambda item: (-item[key], -item["chapterCoverage"], item["name"]))
    return stats


def find_sentence(sentences: list[str], pattern: re.Pattern[str]) -> str:
    for sentence in sentences:
        if pattern.search(normalize_search(sentence)):
            return sentence
    return sentences[0] if sentences else ""


def build_interaction_excerpt(sentences: list[str], index: int) -> str:
    start = max(0, index - 1)
    end = min(len(sentences), index + 2)
    excerpt = " ".join(sentences[start:end]).strip()

    if len(excerpt) < 150 and end < len(sentences):
        end = min(len(sentences), index + 3)
        excerpt = " ".join(sentences[start:end]).strip()

    return shorten(excerpt, 420)


def alias_sequences_for(name: str) -> list[tuple[str, ...]]:
    sequences = []
    seen = set()
    for alias in CHARACTERS[name]:
        tokens = normalize_search(alias).split()
        while len(tokens) > 1 and tokens[0] in HONORIFIC_TOKENS:
            tokens = tokens[1:]
        if not tokens:
            continue
        key = tuple(tokens)
        if key in seen:
            continue
        seen.add(key)
        sequences.append(key)
    return sorted(sequences, key=lambda item: (-len(item), item))


def find_alias_spans(doc, alias_sequences: list[tuple[str, ...]]):
    normalized_tokens = [strip_accents(token.text.lower()) for token in doc]
    spans = []
    index = 0
    while index < len(doc):
        matched = None
        for sequence in alias_sequences:
            end = index + len(sequence)
            if normalized_tokens[index:end] == list(sequence):
                matched = doc[index:end]
                break
        if matched is None:
            index += 1
            continue
        spans.append(matched)
        index = matched.end
    return spans


def iter_adj_chain(token):
    if token.pos_ == "ADJ":
        yield token
    for conjunct in token.conjuncts:
        if conjunct.pos_ == "ADJ":
            yield conjunct


def looks_like_misparsed_adjective(token) -> bool:
    text = strip_accents(token.text.lower())
    return (
        token.pos_ == "VERB"
        and token.dep_ == "acl"
        and len(text) >= 4
        and text.endswith(("o", "a", "os", "as"))
        and not text.endswith(("ando", "endo", "indo"))
    )


def is_participle_like_descriptor(token) -> bool:
    text = strip_accents(token.text.lower())
    lemma = strip_accents(token.lemma_.lower()) if token.lemma_ and token.lemma_ != "-PRON-" else ""
    return (
        token.pos_ == "ADJ"
        and (
            (lemma.endswith(("ar", "er", "ir")) and text.endswith(("ado", "ada", "ados", "adas", "ido", "ida", "idos", "idas")))
            or text.endswith(("sto", "sta", "stos", "stas", "eito", "eita", "eitos", "eitas"))
        )
    )


def descriptor_lemma(token) -> str:
    text = strip_accents(token.text.lower())
    if looks_like_misparsed_adjective(token):
        return text
    lemma = strip_accents(token.lemma_.lower()) if token.lemma_ and token.lemma_ != "-PRON-" else ""
    if not lemma:
        return text
    if lemma.endswith("r") and not text.endswith("r") and lemma.startswith(text):
        return text
    return lemma if len(lemma) <= len(text) + 1 else text


def descriptor_surface(token) -> str:
    text = token.text.lower().strip()
    return re.sub(r"(^[^a-zà-ÿ]+|[^a-zà-ÿ-]+$)", "", text)


def has_blocked_descriptor_children(token, allow_copular: bool = False) -> bool:
    blocked_deps = (
        BLOCKED_DESCRIPTOR_DEPS - {"cop", "nsubj", "nsubj:pass", "mark"}
        if allow_copular
        else BLOCKED_DESCRIPTOR_DEPS
    )
    return any(child.dep_ in blocked_deps for child in token.children)


def has_negation_marker(token) -> bool:
    return any(strip_accents(child.text.lower()) == "nao" for child in token.children)


def is_appositive_descriptor(token, span) -> bool:
    if token.dep_ != "amod":
        return False
    if token.i < span.start:
        return True
    if token.i <= span.end - 1:
        return False
    prev_token = token.nbor(-1) if token.i > 0 else None
    next_token = token.nbor(1) if token.i + 1 < len(token.doc) else None
    return (
        prev_token is not None
        and prev_token.text in APPOSITIVE_PUNCT
        and next_token is not None
        and next_token.text in APPOSITIVE_PUNCT
    )


def accept_descriptor(
    token,
    allow_copular: bool = False,
    allow_predicate_noun: bool = False,
) -> bool:
    lemma = descriptor_lemma(token)
    is_adjective = token.pos_ == "ADJ" or looks_like_misparsed_adjective(token)
    is_predicate_noun = allow_predicate_noun and token.pos_ == "NOUN"
    return not (
        not (is_adjective or is_predicate_noun)
        or
        len(lemma) < 4
        or lemma in STOP_WORDS
        or lemma in GENERIC_ADJECTIVE_STOPLIST
        or lemma in GENERIC_DESCRIPTOR_NOUN_STOPLIST
        or (token.pos_ == "NOUN" and lemma not in PREDICATE_DESCRIPTOR_NOUN_ALLOWLIST)
        or is_participle_like_descriptor(token)
        or has_negation_marker(token)
        or has_blocked_descriptor_children(token, allow_copular=allow_copular)
        or not re.fullmatch(r"[a-zà-ÿ-]+", token.text.lower())
    )


def add_descriptor_candidate(
    name: str,
    token,
    sentence: str,
    chapter: dict,
    counters,
    surface_forms,
    evidence,
    seen_examples,
    allow_copular: bool = False,
    allow_predicate_noun: bool = False,
) -> None:
    if not accept_descriptor(
        token,
        allow_copular=allow_copular,
        allow_predicate_noun=allow_predicate_noun,
    ):
        return
    lemma = descriptor_lemma(token)
    surface = descriptor_surface(token) or lemma
    counters[name][lemma] += 1
    surface_forms[name][lemma][surface] += 1
    excerpt = shorten(sentence, 320)
    normalized_excerpt = normalize_search(excerpt)
    if normalized_excerpt in seen_examples[name][lemma]:
        return
    seen_examples[name][lemma].add(normalized_excerpt)
    if len(evidence[name][lemma]) >= 3:
        return
    evidence[name][lemma].append(
        {
            "excerpt": excerpt,
            "surface": surface,
            "chapterId": chapter["id"],
            "chapterTitle": chapter["full_title"],
            "partTitle": chapter["part_title"],
            "bookTitle": chapter["book_title"],
            "pageStart": chapter["page_start"],
            "pageEnd": chapter["page_end"],
        }
    )


def has_copular_child(token) -> bool:
    return any(
        child.dep_ == "cop"
        and strip_accents(child.lemma_.lower()) in DESCRIPTOR_COPULAR_VERBS
        for child in token.children
        if child.lemma_
    )


def has_semicolon_between(doc, start: int, end: int) -> bool:
    return any(token.text == ";" for token in doc[start:end])


def add_explicit_sentence_descriptor_candidates(
    name: str,
    span,
    sentence: str,
    chapter: dict,
    counters,
    surface_forms,
    evidence,
    seen_examples,
) -> None:
    doc = span.doc
    limit = len(doc)
    for token in doc[span.end :]:
        if token.text in {".", "!", "?"}:
            limit = token.i
            break

    for token in doc[span.end :limit]:
        if token.i <= span.end or token.is_punct:
            continue

        follows_semicolon = has_semicolon_between(doc, span.end, token.i)
        should_consider = False

        if token.dep_ in {"ccomp", "ROOT", "appos", "xcomp"} and has_copular_child(token):
            should_consider = True
        elif follows_semicolon and (
            token.dep_ in {"appos", "xcomp", "conj"}
            or looks_like_misparsed_adjective(token)
            or token.pos_ in {"ADJ", "NOUN"}
        ):
            should_consider = True

        if not should_consider:
            continue

        add_descriptor_candidate(
            name,
            token,
            sentence,
            chapter,
            counters,
            surface_forms,
            evidence,
            seen_examples,
            allow_copular=True,
            allow_predicate_noun=True,
        )

        for candidate in iter_adj_chain(token):
            if candidate.i == token.i:
                continue
            add_descriptor_candidate(
                name,
                candidate,
                sentence,
                chapter,
                counters,
                surface_forms,
                evidence,
                seen_examples,
                allow_copular=True,
            )


def build_interactions(
    chapters: list[dict], character_patterns: dict[str, re.Pattern[str]], top_names: list[str]
) -> list[dict]:
    edges: Counter[tuple[str, str]] = Counter()
    examples: defaultdict[tuple[str, str], list[dict]] = defaultdict(list)
    seen_examples: defaultdict[tuple[str, str], set[str]] = defaultdict(set)
    top_set = set(top_names)

    for chapter in chapters:
        for sentence_index, sentence in enumerate(chapter["sentences"]):
            sentence_search = normalize_search(sentence)
            present = sorted({name for name in top_set if character_patterns[name].search(sentence_search)})
            if len(present) < 2:
                continue
            for source_index, source in enumerate(present):
                for target in present[source_index + 1 :]:
                    pair = (source, target)
                    excerpt = build_interaction_excerpt(chapter["sentences"], sentence_index)
                    edges[(source, target)] += 1
                    if len(examples[pair]) >= 3:
                        continue
                    normalized_excerpt = normalize_search(excerpt)
                    if normalized_excerpt in seen_examples[pair]:
                        continue
                    seen_examples[pair].add(normalized_excerpt)
                    examples[pair].append(
                        {
                            "excerpt": excerpt,
                            "chapterId": chapter["id"],
                            "chapterTitle": chapter["full_title"],
                            "partTitle": chapter["part_title"],
                            "bookTitle": chapter["book_title"],
                            "pageStart": chapter["page_start"],
                            "pageEnd": chapter["page_end"],
                        }
                    )

    interaction_list = [
        {
            "source": source,
            "target": target,
            "weight": weight,
            "examples": examples[(source, target)],
        }
        for (source, target), weight in edges.items()
        if weight >= 2
    ]
    interaction_list.sort(key=lambda item: (-item["weight"], item["source"], item["target"]))
    return interaction_list


def extract_part_summaries(
    parts: list[dict], books: list[dict], chapters: list[dict], character_stats: list[dict]
) -> list[dict]:
    character_lookup = {item["name"]: item for item in character_stats}
    part_lookup = {part["id"]: part for part in parts}
    book_lookup = {book["id"]: book for book in books}

    for part in parts:
        part_chapters = [chapter for chapter in chapters if chapter["part_id"] == part["id"]]
        counter = Counter()
        word_count = 0
        for chapter in part_chapters:
            counter.update(chapter["character_counts"])
            word_count += len(tokenize(chapter["text"]))
        leaders = [
            {"name": name, "mentions": mentions, "tier": character_lookup[name]["tier"]}
            for name, mentions in counter.most_common(4)
        ]
        part["chapterCount"] = len(part_chapters)
        part["wordCount"] = word_count
        part["topCharacters"] = leaders

    for book in books:
        book_chapters = [chapter for chapter in chapters if chapter["book_id"] == book["id"]]
        counter = Counter()
        for chapter in book_chapters:
            counter.update(chapter["character_counts"])
        book["chapterCount"] = len(book_chapters)
        book["topCharacters"] = [
            {"name": name, "mentions": mentions}
            for name, mentions in counter.most_common(3)
        ]
        if book["part_id"] in part_lookup:
            book["partTitle"] = part_lookup[book["part_id"]]["title"]

    return [
        {
            "id": part["id"],
            "title": part["title"],
            "chapterCount": part["chapterCount"],
            "wordCount": part["wordCount"],
            "topCharacters": part["topCharacters"],
            "books": [
                {
                    "id": book_id,
                    "title": book_lookup[book_id]["title"],
                    "chapterCount": book_lookup[book_id]["chapterCount"],
                    "topCharacters": book_lookup[book_id]["topCharacters"],
                }
                for book_id in part["book_ids"]
            ],
        }
        for part in parts
    ]


def extract_descriptors(
    chapters: list[dict], character_patterns: dict[str, re.Pattern[str]], top_names: list[str]
) -> dict[str, list[dict]]:
    nlp = spacy.load("pt_core_news_sm", disable=["ner"])
    descriptors: dict[str, Counter[str]] = {name: Counter() for name in top_names}
    surface_forms: dict[str, defaultdict[str, Counter[str]]] = {
        name: defaultdict(Counter) for name in top_names
    }
    evidence: dict[str, defaultdict[str, list[dict]]] = {
        name: defaultdict(list) for name in top_names
    }
    seen_examples: dict[str, defaultdict[str, set[str]]] = {
        name: defaultdict(set) for name in top_names
    }
    alias_sequences = {name: alias_sequences_for(name) for name in top_names}

    texts = []
    payload = []
    for chapter in chapters:
        for sentence in chapter["sentences"]:
            sentence_search = normalize_search(sentence)
            for name in top_names:
                if character_patterns[name].search(sentence_search):
                    texts.append(sentence)
                    payload.append((name, sentence, chapter))

    docs = nlp.pipe(texts, batch_size=32)
    for doc, (name, sentence, chapter) in zip(docs, payload):
        spans = find_alias_spans(doc, alias_sequences[name])
        if not spans:
            continue

        for span in spans:
            root = span.root
            seen_candidates = set()

            for child in root.children:
                if not is_appositive_descriptor(child, span):
                    continue
                for candidate in iter_adj_chain(child):
                    if candidate.i in seen_candidates:
                        continue
                    seen_candidates.add(candidate.i)
                    add_descriptor_candidate(
                        name,
                        candidate,
                        sentence,
                        chapter,
                        descriptors,
                        surface_forms,
                        evidence,
                        seen_examples,
                    )

            head = root.head
            copular_lemmas = {
                strip_accents(child.lemma_.lower())
                for child in head.children
                if child.dep_ == "cop" and child.lemma_
            }
            has_copular_frame = (
                root.dep_ == "nsubj"
                and root.i < head.i
                and (
                    bool(copular_lemmas & DESCRIPTOR_COPULAR_VERBS)
                    or strip_accents(head.lemma_.lower()) in DESCRIPTOR_COPULAR_VERBS
                )
            )
            if not has_copular_frame:
                continue

            for candidate in iter_adj_chain(head):
                if candidate.i in seen_candidates:
                    continue
                seen_candidates.add(candidate.i)
                add_descriptor_candidate(
                    name,
                    candidate,
                    sentence,
                    chapter,
                    descriptors,
                    surface_forms,
                    evidence,
                    seen_examples,
                    allow_copular=True,
                )

            add_descriptor_candidate(
                name,
                head,
                sentence,
                chapter,
                descriptors,
                surface_forms,
                evidence,
                seen_examples,
                allow_copular=True,
                allow_predicate_noun=True,
            )

            for child in head.children:
                if child.dep_ in {"amod", "conj"}:
                    for candidate in iter_adj_chain(child):
                        if candidate.i in seen_candidates:
                            continue
                        seen_candidates.add(candidate.i)
                        add_descriptor_candidate(
                            name,
                            candidate,
                            sentence,
                            chapter,
                            descriptors,
                            surface_forms,
                            evidence,
                            seen_examples,
                            allow_copular=True,
                        )

                if looks_like_misparsed_adjective(child):
                    if child.i not in seen_candidates:
                        seen_candidates.add(child.i)
                        add_descriptor_candidate(
                            name,
                            child,
                            sentence,
                            chapter,
                            descriptors,
                            surface_forms,
                            evidence,
                            seen_examples,
                            allow_copular=True,
                        )

                if child.pos_ != "NOUN" or child.dep_ not in {"nmod", "conj", "appos"}:
                    continue

                if child.i not in seen_candidates:
                    seen_candidates.add(child.i)
                    add_descriptor_candidate(
                        name,
                        child,
                        sentence,
                        chapter,
                        descriptors,
                        surface_forms,
                        evidence,
                        seen_examples,
                        allow_copular=True,
                        allow_predicate_noun=True,
                    )

                for candidate in iter_adj_chain(child):
                    if candidate.i in seen_candidates:
                        continue
                    seen_candidates.add(candidate.i)
                    add_descriptor_candidate(
                        name,
                        candidate,
                        sentence,
                        chapter,
                        descriptors,
                        surface_forms,
                        evidence,
                        seen_examples,
                        allow_copular=True,
                    )

                for grandchild in child.children:
                    if looks_like_misparsed_adjective(grandchild) and grandchild.i not in seen_candidates:
                        seen_candidates.add(grandchild.i)
                        add_descriptor_candidate(
                            name,
                            grandchild,
                            sentence,
                            chapter,
                            descriptors,
                            surface_forms,
                            evidence,
                            seen_examples,
                            allow_copular=True,
                        )
                    for candidate in iter_adj_chain(grandchild):
                        if candidate.i in seen_candidates:
                            continue
                        seen_candidates.add(candidate.i)
                        add_descriptor_candidate(
                            name,
                            candidate,
                            sentence,
                            chapter,
                            descriptors,
                            surface_forms,
                            evidence,
                            seen_examples,
                            allow_copular=True,
                        )
                    if grandchild.pos_ == "NOUN" and grandchild.dep_ in {"conj", "appos"} and grandchild.i not in seen_candidates:
                        seen_candidates.add(grandchild.i)
                        add_descriptor_candidate(
                            name,
                            grandchild,
                            sentence,
                            chapter,
                            descriptors,
                            surface_forms,
                            evidence,
                            seen_examples,
                            allow_copular=True,
                            allow_predicate_noun=True,
                        )

            add_explicit_sentence_descriptor_candidates(
                name,
                span,
                sentence,
                chapter,
                descriptors,
                surface_forms,
                evidence,
                seen_examples,
            )

    result = {}
    for name in top_names:
        result[name] = [
            {
                "key": word,
                "word": surface_forms[name][word].most_common(1)[0][0] if surface_forms[name].get(word) else word,
                "count": count,
                "excerpt": evidence[name][word][0]["excerpt"] if evidence[name].get(word) else "",
                "chapterId": evidence[name][word][0]["chapterId"] if evidence[name].get(word) else None,
                "chapterTitle": evidence[name][word][0]["chapterTitle"] if evidence[name].get(word) else "",
                "partTitle": evidence[name][word][0]["partTitle"] if evidence[name].get(word) else "",
                "bookTitle": evidence[name][word][0]["bookTitle"] if evidence[name].get(word) else "",
                "pageStart": evidence[name][word][0]["pageStart"] if evidence[name].get(word) else None,
                "pageEnd": evidence[name][word][0]["pageEnd"] if evidence[name].get(word) else None,
                "examples": evidence[name][word],
            }
            for word, count in descriptors[name].most_common(7)
            if count >= 1
        ]
    return result


def extract_content_terms(text: str) -> list[str]:
    counts = Counter(
        token
        for token in tokenize(text)
        if token not in STOP_WORDS and len(token) >= 5 and not token.isdigit()
    )
    return [token for token, _count in counts.most_common(6)]


def is_meta_sentence(sentence: str) -> bool:
    normalized = normalize_search(sentence)
    return any(pattern in normalized for pattern in META_SENTENCE_PATTERNS)


def clean_summary_sentence(sentence: str) -> str:
    text = collapse_spaces(sentence.strip(" \"'«»"))
    text = re.sub(r"^[—-]\s*", "", text)
    text = re.sub(
        r"^(embora|porém|contudo|todavia|entretanto|ora)\b[^,]{0,80},\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\s+", " ", text).strip(" ,;:")
    if text:
        text = text[0].upper() + text[1:]
    if text and text[-1] not in ".!?…":
        text = f"{text}."
    return shorten(text, 190)


def is_dialogue_like(sentence: str) -> bool:
    stripped = sentence.lstrip()
    return stripped.startswith(("—", "-")) or "—" in sentence or "«" in sentence or "»" in sentence


def score_chapter_sentence(
    sentence: str,
    index: int,
    top_character_names: list[str],
    top_place_names: list[str],
    title_terms: list[str],
    content_terms: list[str],
) -> float:
    normalized = normalize_search(sentence)
    tokens = set(tokenize(sentence))
    score = 0.0
    length = len(sentence)

    if 70 <= length <= 230:
        score += 2.5
    elif 50 <= length <= 280:
        score += 1.0
    else:
        score -= 1.5

    if index < 6:
        score += max(0.0, 2.2 - (index * 0.3))

    if is_dialogue_like(sentence):
        score -= 4.5

    if is_meta_sentence(sentence):
        score -= 5.0

    if sentence.count(",") >= 5 and length > 180:
        score -= 1.0

    if ":" in sentence and any(char.isdigit() for char in sentence):
        score -= 3.0

    if sum(char.isdigit() for char in sentence) >= 3:
        score -= 1.5

    for name in top_character_names:
        if normalize_search(name) in normalized:
            score += 3.5

    for place in top_place_names:
        if normalize_search(place) in normalized:
            score += 2.0

    score += 0.9 * sum(1 for term in title_terms if term in tokens)
    score += 0.6 * sum(1 for term in content_terms[:4] if term in tokens)
    return score


def choose_chapter_sentences(
    chapter: dict,
    top_character_names: list[str],
    top_place_names: list[str],
    content_terms: list[str],
) -> tuple[str, str]:
    sentences = chapter["sentences"]
    if not sentences:
        return "", ""

    title_terms = [
        token
        for token in tokenize(chapter["title"])
        if token not in STOP_WORDS and len(token) >= 4
    ]

    ranked = sorted(
        [
            (
                score_chapter_sentence(
                    sentence,
                    index,
                    top_character_names,
                    top_place_names,
                    title_terms,
                    content_terms,
                ),
                index,
                sentence,
            )
            for index, sentence in enumerate(sentences)
        ],
        key=lambda item: (-item[0], item[1]),
    )

    summary_sentence = next(
        (
            sentence
            for _score, _index, sentence in ranked
            if not is_dialogue_like(sentence) and not is_meta_sentence(sentence)
        ),
        ranked[0][2],
    )
    support_sentence = ""
    for _score, _index, sentence in ranked[1:]:
        if sentence != summary_sentence:
            support_sentence = sentence
            break

    return summary_sentence, support_sentence or summary_sentence


def build_chapter_focus(
    summary_sentence: str,
    top_character_names: list[str],
    top_place_names: list[str],
) -> str:
    summary = clean_summary_sentence(summary_sentence)
    context_bits = []
    if top_character_names:
        context_bits.append(join_labels(top_character_names[:2]))
    if top_place_names:
        context_bits.append(top_place_names[0])

    if not context_bits:
        return summary

    if len(context_bits) == 2:
        context = f"O capítulo gira sobretudo em torno de {context_bits[0]} e de {context_bits[1]}."
    else:
        context = f"O capítulo gira sobretudo em torno de {context_bits[0]}."

    return f"{summary} {context}"


def build_chapter_cards(
    chapters: list[dict],
    city_stats: list[dict],
    character_stats: list[dict],
) -> list[dict]:
    city_lookup = {
        city["name"]: compile_alias_pattern(city["aliases"])
        for city in CITY_PLACES
    }
    character_lookup = {item["name"]: item for item in character_stats}
    cards = []

    for chapter in chapters:
        top_characters = sorted(
            chapter["character_counts"].items(),
            key=lambda item: (-item[1], item[0]),
        )[:3]
        top_places = []
        for city_name, pattern in city_lookup.items():
            count = len(pattern.findall(chapter["search_text"]))
            if count:
                top_places.append((city_name, count))
        top_places.sort(key=lambda item: (-item[1], item[0]))

        lead_sentence = chapter["sentences"][0] if chapter["sentences"] else chapter["text"]
        content_terms = extract_content_terms(chapter["text"])
        top_names = [name for name, _count in top_characters[:2]]
        place_names = [name for name, _count in top_places[:2]]
        summary_sentence, evidence_sentence = choose_chapter_sentences(
            chapter,
            top_names,
            place_names,
            content_terms,
        )

        cards.append(
            {
                "id": chapter["id"],
                "seq": chapter["seq"],
                "roman": chapter["roman"],
                "title": chapter["title"],
                "fullTitle": chapter["full_title"],
                "partId": chapter["part_id"],
                "partTitle": chapter["part_title"],
                "bookId": chapter["book_id"],
                "bookTitle": chapter["book_title"],
                "pageStart": chapter["page_start"],
                "pageEnd": chapter["page_end"],
                "wordCount": len(tokenize(chapter["text"])),
                "topTerms": content_terms[:6],
                "focus": build_chapter_focus(summary_sentence, top_names, place_names),
                "leadExcerpt": shorten(lead_sentence, 280),
                "evidenceExcerpt": shorten(evidence_sentence, 280),
                "topCharacters": [
                    {
                        "name": name,
                        "mentions": count,
                        "tier": character_lookup.get(name, {}).get("tier", "apoio"),
                    }
                    for name, count in top_characters
                ],
                "topPlaces": [
                    {"name": name, "mentions": count}
                    for name, count in top_places[:3]
                ],
            }
        )

    return cards


def build_evidence_cards(
    character_stats: list[dict],
    city_stats: list[dict],
    setting_stats: list[dict],
    interactions: list[dict],
    chapter_cards: list[dict],
    descriptor_map: dict[str, list[dict]],
    chapters: list[dict],
    character_patterns: dict[str, re.Pattern[str]],
) -> list[dict]:
    chapter_lookup = {chapter["id"]: chapter for chapter in chapters}
    card_lookup = {card["id"]: card for card in chapter_cards}

    strongest_character = character_stats[0]
    strongest_city = city_stats[0]
    strongest_setting = setting_stats[0]
    strongest_edge = interactions[0] if interactions else None
    descriptor_character = next((item for item in character_stats if descriptor_map.get(item["name"])), None)

    cards = []

    for chapter in chapters:
        if chapter["character_counts"].get(strongest_character["name"], 0):
            cards.append(
                {
                    "title": "Personagem mais presente",
                    "metric": strongest_character["name"],
                    "label": f"{strongest_character['mentions']} menções em {strongest_character['chapterCoverage']} capítulos",
                    "excerpt": shorten(find_sentence(chapter["sentences"], character_patterns[strongest_character["name"]])),
                    "chapterId": chapter["id"],
                    "chapterTitle": chapter["full_title"],
                    "pageStart": chapter["page_start"],
                    "pageEnd": chapter["page_end"],
                }
            )
            break

    city_example = strongest_city["examples"][0] if strongest_city.get("examples") else None
    city_chapter_id = city_example["chapterId"] if city_example else next(
        (
            card["id"]
            for card in chapter_cards
            if any(place["name"] == strongest_city["name"] for place in card["topPlaces"])
        ),
        chapter_cards[0]["id"],
    )
    city_chapter = chapter_lookup[city_chapter_id]
    cards.append(
        {
            "title": "Cidade mais citada",
            "metric": strongest_city["name"],
            "label": f"{strongest_city['mentions']} menções",
            "excerpt": city_example["excerpt"] if city_example else strongest_city["excerpt"],
            "chapterId": city_chapter_id,
            "chapterTitle": city_example["chapterTitle"] if city_example else city_chapter["full_title"],
            "pageStart": city_example["pageStart"] if city_example else city_chapter["page_start"],
            "pageEnd": city_example["pageEnd"] if city_example else city_chapter["page_end"],
        }
    )

    setting_example = strongest_setting["examples"][0] if strongest_setting.get("examples") else None
    setting_chapter_id = setting_example["chapterId"] if setting_example else next(
        (
            card["id"]
            for card in chapter_cards
            if strongest_setting["name"].split(" ")[0].lower() in normalize_search(card["leadExcerpt"])
        ),
        chapter_cards[0]["id"],
    )
    setting_chapter = chapter_lookup[setting_chapter_id]
    cards.append(
        {
            "title": "Cenário recorrente",
            "metric": strongest_setting["name"],
            "label": f"{strongest_setting['mentions']} referências",
            "excerpt": setting_example["excerpt"] if setting_example else strongest_setting["excerpt"],
            "chapterId": setting_chapter_id,
            "chapterTitle": setting_example["chapterTitle"] if setting_example else setting_chapter["full_title"],
            "pageStart": setting_example["pageStart"] if setting_example else setting_chapter["page_start"],
            "pageEnd": setting_example["pageEnd"] if setting_example else setting_chapter["page_end"],
        }
    )

    if strongest_edge:
        edge_example = strongest_edge["examples"][0] if strongest_edge.get("examples") else None
        edge_excerpt = edge_example["excerpt"] if edge_example else ""
        edge_chapter_id = edge_example["chapterId"] if edge_example else chapter_cards[0]["id"]
        cards.append(
            {
                "title": "Par de personagens mais próximo",
                "metric": f"{strongest_edge['source']} x {strongest_edge['target']}",
                "label": f"{strongest_edge['weight']} frases com os dois nomes",
                "excerpt": edge_excerpt,
                "chapterId": edge_chapter_id,
                "chapterTitle": edge_example["chapterTitle"] if edge_example else chapter_lookup[edge_chapter_id]["full_title"],
                "pageStart": edge_example["pageStart"] if edge_example else None,
                "pageEnd": edge_example["pageEnd"] if edge_example else None,
            }
        )

    if descriptor_character:
        descriptor = descriptor_map[descriptor_character["name"]][0]
        descriptor_example = descriptor["examples"][0] if descriptor.get("examples") else None
        descriptor_chapter_id = descriptor_example["chapterId"] if descriptor_example else next(
            (
                card["id"]
                for card in chapter_cards
                if descriptor_character["name"] in [item["name"] for item in card["topCharacters"]]
            ),
            chapter_cards[0]["id"],
        )
        descriptor_chapter = chapter_lookup[descriptor_chapter_id]
        cards.append(
            {
                "title": "Adjetivo recorrente",
                "metric": f"{descriptor_character['name']} — {descriptor['word']}",
                "label": f"{descriptor['count']} ocorrências do descritor",
                "excerpt": descriptor["excerpt"],
                "chapterId": descriptor_chapter_id,
                "chapterTitle": descriptor_example["chapterTitle"] if descriptor_example else descriptor_chapter["full_title"],
                "pageStart": descriptor["pageStart"] if descriptor["pageStart"] is not None else descriptor_chapter["page_start"],
                "pageEnd": descriptor["pageEnd"] if descriptor["pageEnd"] is not None else descriptor_chapter["page_end"],
            }
        )

    return cards


def build_valjean_chunks(chapters: list[dict], valjean_pattern: re.Pattern[str]) -> list[dict]:
    chunks = []
    seen = set()

    for chapter in chapters:
        sentences = chapter["sentences"]
        hits = [
            index
            for index, sentence in enumerate(sentences)
            if valjean_pattern.search(normalize_search(sentence))
        ]
        if not hits:
            continue

        windows = set()
        for index in hits:
            windows.add((max(0, index - 1), min(len(sentences), index + 2)))

        for start, end in sorted(windows):
            text = " ".join(sentences[start:end]).strip()
            if len(text) < 110:
                continue
            normalized = normalize_search(text)
            if normalized in seen:
                continue
            seen.add(normalized)
            chunks.append(
                {
                    "id": f"valjean-{len(chunks) + 1:04d}",
                    "chapterId": chapter["id"],
                    "chapterTitle": chapter["full_title"],
                    "partTitle": chapter["part_title"],
                    "bookTitle": chapter["book_title"],
                    "pageStart": chapter["page_start"],
                    "pageEnd": chapter["page_end"],
                    "text": shorten(text, 520),
                }
            )

    return chunks


def build_payload(pdf_path: Path) -> dict[str, object]:
    toc_entries = load_toc(pdf_path)
    pages = load_pages(pdf_path)
    parts, books, chapters = build_chapters(toc_entries, pages)

    character_stats, character_patterns = extract_character_stats(chapters)
    city_stats = extract_place_stats(chapters, CITY_PLACES, "mentions")
    setting_stats = extract_place_stats(chapters, SETTINGS, "mentions")
    top_character_names = [item["name"] for item in character_stats[:16]]
    interactions = build_interactions(chapters, character_patterns, top_character_names)
    part_summaries = extract_part_summaries(parts, books, chapters, character_stats)
    descriptor_map = extract_descriptors(
        chapters,
        character_patterns,
        [item["name"] for item in character_stats],
    )
    chapter_cards = build_chapter_cards(chapters, city_stats, character_stats)
    evidence_cards = build_evidence_cards(
        character_stats,
        city_stats,
        setting_stats,
        interactions,
        chapter_cards,
        descriptor_map,
        chapters,
        character_patterns,
    )
    valjean_chunks = build_valjean_chunks(chapters, character_patterns["Jean Valjean"])

    for item in character_stats:
        item["descriptors"] = descriptor_map.get(item["name"], [])

    overview = {
        "meta": {
            "title": "Os Miseráveis",
            "author": "Victor Hugo",
            "translator": "Francisco Ferreira da Silva Vieira",
            "pdfPages": len(pages),
            "parts": len(parts),
            "books": len(books),
            "chapters": len(chapters),
            "trackedCharacters": len(character_stats),
            "mappedCities": len(city_stats),
            "chatChunks": len(valjean_chunks),
        },
        "parts": part_summaries,
        "characters": character_stats,
        "cities": city_stats,
        "settings": setting_stats,
        "interactions": interactions,
        "evidenceCards": evidence_cards,
        "methodology": [
            "As contagens de personagens reúnem formas diferentes do mesmo nome ou identidade nesta edição, como Jean Valjean e senhor Madelaine.",
            "Interação significa que dois nomes aparecem na mesma frase; é uma aproximação de cena, não uma leitura crítica completa.",
        ],
    }

    chapter_payload = [
        {
            "id": card["id"],
            "seq": card["seq"],
            "roman": card["roman"],
            "title": card["title"],
            "fullTitle": card["fullTitle"],
            "partId": card["partId"],
            "partTitle": card["partTitle"],
            "bookId": card["bookId"],
            "bookTitle": card["bookTitle"],
            "pageStart": card["pageStart"],
            "pageEnd": card["pageEnd"],
            "wordCount": card["wordCount"],
            "topTerms": card["topTerms"],
            "focus": card["focus"],
            "leadExcerpt": card["leadExcerpt"],
            "evidenceExcerpt": card["evidenceExcerpt"],
            "topCharacters": card["topCharacters"],
            "topPlaces": card["topPlaces"],
        }
        for card in chapter_cards
    ]

    return {
        "overview": overview,
        "chapters": chapter_payload,
        "valjeanChat": {
            "character": "Jean Valjean",
            "rules": {
                "scope": "Responder apenas com base em trechos do livro ligados à presença ou ao conhecimento imediato de Jean Valjean.",
                "fallback": "Quando a evidência for fraca, admitir incerteza e dizer que só pode especular.",
            },
            "chunks": valjean_chunks,
        },
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gera os datasets da página valjIAn.")
    parser.add_argument("--pdf", required=True, help="PDF de origem.")
    parser.add_argument("--outdir", required=True, help="Diretório de saída para os JSONs.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_path = Path(args.pdf).expanduser().resolve()
    outdir = Path(args.outdir).expanduser().resolve()
    payload = build_payload(pdf_path)
    write_json(outdir / "overview.json", payload["overview"])
    write_json(outdir / "chapters.json", payload["chapters"])
    write_json(outdir / "valjean-chat.json", payload["valjeanChat"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
