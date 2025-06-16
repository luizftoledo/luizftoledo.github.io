import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Search, GraduationCap, Award, ExternalLink, Menu, X, ChevronDown, Mail, Twitter, Linkedin, Github, Play, Headphones, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import luizPhoto from './assets/luiz-photo.png'
import './App.css'

function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [gifProgress, setGifProgress] = useState(0)
  const [currentInterview, setCurrentInterview] = useState(0)
  const language = 'en' // Fixed to English only

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Update GIF progress bar every 100ms
    const interval = setInterval(() => {
      const now = Date.now()
      const cycleTime = 7250 // 7.25 seconds in milliseconds
      const progress = ((now % cycleTime) / cycleTime) * 100
      setGifProgress(progress)
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const navigationItems = [
    { id: 'investigative', label: 'Investigative Journalism', icon: Search },
    { id: 'workshops', label: 'Workshops and Interviews', icon: GraduationCap },
    { id: 'awards', label: 'Awards', icon: Award }
  ]

  const translations = {
    en: {
      title: "I'm Luiz Fernando Toledo,",
      description: "Brazilian journalist, researcher and instructor based in London, with a proven track record of producing and managing impactful projects related to Brazil.",
      curriculum: "📄 Resume",
      reportingImpact: "Reporting Impact",
      training: "Training", 
      research: "Research",
      civilTech: "Civil Tech",
      workshopsAndInterviews: "Workshops and Interviews",
      teachingAndWorkshops: "Teaching and workshops",
      everyYearProjects: "Every year and ongoing projects",
      interviews: "Interviews",
      awardsTitle: "Awards and Honorable Mentions",
      fellowshipsTitle: "Fellowships and Scholarships",
      contact: "Contact",
      // Workshop descriptions
      workshopItems: [
        "→ Curso Estado de Jornalismo (Focas Estadão): Public records and investigative journalism workshop",
        "→ Trainee (Folha de São Paulo): Public records and investigative journalism workshop", 
        "→ Brazilian Association for Investigative Journalism (Abraji) conferences",
        "→ Insper university: Masters in Data Journalism - Introduction to Spreadsheets and data reporting (3-months class)",
        "→ + than 100 workshops held at private and public universities and news organizations."
      ],
      // Interview descriptions
      bellingcatDesc: "I was interviewed by Bellingcat to discuss how to use public records and data to investigate environmental crimes in Brazil. Held in English.",
      gijcDesc: "My presentation about investigating with public records at the Global Investigative Journalism Conference (GIJC), in Gothenburg/Sweden. Held in English.",
      sbtDesc: "I was interviewed by SBT news after presenting a panel about transparency at the Brazilian Association for Investigative Journalism conference, held in São Paulo, Brazil.",
      globoDesc: "I was interviewed by TV Globo host Natuza Nery in one of Brazil's most popular podcasts, O Assunto, to explain how I obtained former presidents corporate expenses, including Bolsonaro, and how to read the data. Held in Portuguese.",
      filDesc: "I was invited by the Filecoin Foundation and Muckrock to present my data journalism project, DataFixers.org, in a conference in Portugal. (Held in English)",
      cnnDesc: "I was interviewed by CNN TV host Monalise Perrone to explain how I did an investigative project about illegal air charter services in São Paulo. Held in Portuguese.",
      culturaDesc: "I was interviewed by Jornal da Cultura, a traditional TV show in Brazil, to explain how Brazil can improve transparency policies in 2023. Held in Portuguese."
    },
    pt: {
      title: "Sou Luiz Fernando Toledo,",
      description: "Jornalista, pesquisador e instrutor brasileiro baseado em Londres, com histórico comprovado de produção e gestão de projetos de impacto relacionados ao Brasil.",
      curriculum: "📄 Currículo",
      reportingImpact: "Impacto Jornalístico",
      training: "Treinamento",
      entrepreneurship: "Empreendedorismo", 
      research: "Pesquisa",
      civilTech: "Tecnologia Civil",
      workshopsAndInterviews: "Workshops e Entrevistas",
      teachingAndWorkshops: "Ensino e workshops",
      everyYearProjects: "Projetos anuais e contínuos",
      interviews: "Entrevistas",
      awardsTitle: "Prêmios e Menções Honrosas",
      fellowshipsTitle: "Bolsas e Fellowships",
      contact: "Contato",
      // Workshop descriptions
      workshopItems: [
        "→ Curso Estado de Jornalismo (Focas Estadão): Workshop de registros públicos e jornalismo investigativo",
        "→ Trainee (Folha de São Paulo): Workshop de registros públicos e jornalismo investigativo",
        "→ Conferências da Associação Brasileira de Jornalismo Investigativo (Abraji)",
        "→ Universidade Insper: Mestrado em Jornalismo de Dados - Introdução a Planilhas e reportagem de dados (aula de 3 meses)",
        "→ + de 100 workshops realizados em universidades públicas e privadas e organizações de notícias."
      ],
      // Interview descriptions  
      bellingcatDesc: "Fui entrevistado pela Bellingcat para discutir como usar registros públicos e dados para investigar crimes ambientais no Brasil. Realizada em inglês.",
      gijcDesc: "Minha apresentação sobre investigação com registros públicos na Conferência Global de Jornalismo Investigativo (GIJC), em Gotemburgo/Suécia. Realizada em inglês.",
      sbtDesc: "Fui entrevistado pelo SBT News após apresentar um painel sobre transparência na conferência da Associação Brasileira de Jornalismo Investigativo, realizada em São Paulo, Brasil.",
      globoDesc: "Fui entrevistado pela apresentadora da TV Globo Natuza Nery em um dos podcasts mais populares do Brasil, O Assunto, para explicar como obtive gastos corporativos de ex-presidentes, incluindo Bolsonaro, e como ler os dados. Realizada em português.",
      filDesc: "Fui convidado pela Fundação Filecoin e Muckrock para apresentar meu projeto de jornalismo de dados, DataFixers.org, em uma conferência em Portugal. (Realizada em inglês)",
      cnnDesc: "Fui entrevistado pela apresentadora da CNN TV Monalise Perrone para explicar como fiz um projeto investigativo sobre serviços ilegais de fretamento aéreo em São Paulo. Realizada em português.",
      culturaDesc: "Fui entrevistado pelo Jornal da Cultura, um programa de TV tradicional no Brasil, para explicar como o Brasil pode melhorar as políticas de transparência em 2023. Realizada em português."
    }
  }

  const t = translations[language]

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setActiveSection(sectionId)
      setIsMenuOpen(false)
    }
  }

  const investigativeStories = [
    {
      title: "Secret Budget Amendment Linked to Slave Labor",
      description: "Investigation reveals how a budget amendment supported by Chamber President Hugo Motta funded construction using stones produced by workers in slave-like conditions.",
      publication: "BBC News Brasil",
      link: "https://www.bbc.com/portuguese/articles/c1drv0wkr9ro",
      linkText: "Portuguese version",
      image: "/hugo-motta.jpg"
    },
    {
      title: "Brazilians Face Abuse in Irish Meat Industry", 
      description: "Exclusive investigation exposes precarious working conditions and abuse faced by Brazilian workers in Ireland's meat processing industry.",
      publication: "BBC News Brasil",
      link: "https://www.bbc.com/portuguese/articles/cdd900l6dnmo",
      linkText: "Portuguese version", 
      image: "/irish-slaughterhouse.jpg"
    },
    {
      title: "Failed enforcement: indigenous objects containing animal parts are freely sold online",
      description: "A 2-month investigation into animal feather smuggling and how companies benefit from exploiting indigenous communities in Brazil",
      publication: "UOL",
      link: "https://tab.uol.com.br/noticias/redacao/2024/07/31/venda-ilegal-de-artefatos-indigenas-cresce-com-baixa-fiscalizacao-nas-redes.htm",
      linkText: "Portuguese version",
      image: "/indigenous-artifacts.jpg"
    },
    {
      title: "Tracking deforestation agents that not even the government knew about",
      description: "This journalistic investigation utilized spatial data to find several individuals involved in deforestation in the Amazon region, previously unknown to the Brazilian authorities. Our project made the government fine the people involved in R$ 1.5 million (around US$ 300,000)",
      publication: "Revista Piauí",
      link: "https://piaui.folha.uol.com.br/desmatamento-amazonia-embargos-icmbio/",
      linkText: "Portuguese version",
      image: "/deforestation-maps.png"
    },
    {
      title: "Political Backing Fuels Land Grabbing in Brazil's Distrito Federal",
      description: "In the Distrito Federal, Brazil, a significant issue of land grabbing in conservation areas is emerging, intensified by political support. These activities are particularly rampant in the Colônia Agrícola 26 de Setembro, a settlement approximately 26 km from the Palácio do Planalto, housing around 35,000 residents.",
      publication: "Revista Piauí",
      link: "https://piaui.folha.uol.com.br/distrito-federal-grileiros-car-brasilia/",
      linkText: "Portuguese version",
      image: "/brazilian-timber.jpg"
    },
    {
      title: "Amazon Underworld",
      description: "A 1-year cross-border series of articles that mapped the presence of organized crime groups in the Amazon region and reported on the field about the impacts of their actions. I coordinated the data analysis and obtained the documents needed for the stories.",
      publication: "InfoAmazonia • Pulitzer Center",
      link: "https://amazonunderworld.org/",
      linkText: "English version",
      additionalLink: "https://amazonunderworld.org/pt.html",
      additionalLinkText: "Portuguese version",
      image: "/amazon-underworld.jpg"
    },
    {
      title: "A world heritage site under attack in Brazil",
      description: "Brazilwood is being driven to extinction by an industry not often associated with organized crime: classical music. Tests on a sample of the confiscated wood show it was logged in a protected forest.",
      publication: "Revista Piauí • OCCRP",
      link: "https://www.occrp.org/en/investigations/a-world-heritage-site-under-attack-in-brazil",
      linkText: "English version",
      additionalLink: "https://piaui.folha.uol.com.br/um-parque-no-coracao-do-contrabando-de-pau-brasil/",
      additionalLinkText: "Portuguese version",
      image: "/pau-brasil-logs.png"
    }
  ]

  const impactCards = [
    {
      title: "Reporting Impact",
      description: "Stories I wrote exposed a former president's misuse of public funds, uncovered a bid fraud that saved R$ 15 million from a city's budget and enabled the shutdown of companies involved in illegal activities.",
      links: [
        { text: "exposed", url: "https://fiquemsabendo.substack.com/p/exclusivo-acessamos-as-notas-fiscais" },
        { text: "uncovered", url: "https://www.estadao.com.br/sao-paulo/prefeitura-de-sao-paulo-suspende-pregao-apos-denuncia-do-estado/" },
        { text: "enabled", url: "https://www.cnnbrasil.com.br/nacional/apos-reportagem-da-cnn-empresa-de-taxi-aereo-e-primeira-a-ser-cassada-no-pais/" }
      ]
    },
    {
      title: "Training",
      description: "Attended a fellowship at the Reuters Institute for the Study of Journalism and created a popular journalism course that has been used by several news organizations.",
      links: [
        { text: "a popular journalism course", url: "https://reutersinstitute.politics.ox.ac.uk/how-unlock-potential-freedom-information-requests-your-newsroom" }
      ]
    },
    {
      title: "Research",
      description: "Masters degrees in Data Journalism (Columbia) and Public Administration (FGV-EAESP). Research-assistant at POLIS-Cambridge (2024-2026). Former research fellow at Oxford (2021), Columbia (2022-2023) and NED (2023-2024). My research was used by the government to improve transparency policies.",
      links: [
        { text: "research", url: "https://www.scielo.br/j/cebape/a/JbgP4kK8GsbkPK8gL7c6MqK/abstract/?lang=en" },
        { text: "used by the government", url: "https://www.documentcloud.org/documents/24373761-relatorio-gt-transparencia-integridade-e-controle#document/p26/a2423779" }
      ]
    },
    {
      title: "Civil Tech",
      description: "I have developed interactive dashboards and chatbots to support journalists during my fellowship at the National Endowment for Democracy (NED).",
      links: [
        { text: "interactive dashboards", url: "https://datafixers.org/emendas_parlamentares" },
        { text: "chatbots", url: "https://datafixers.org/laibot" },
        { text: "fellowship", url: "https://www.cima.ned.org/blog/how-artificial-intelligence-can-facilitate-investigative-journalism/" }
      ]
    }
  ]

  const realAwards = [
    {
      title: "Premio Gabo 2024 - coverage (shortlist) with InfoAmazonia and Datafixers.org",
      organization: "Fundación Gabo",
      year: "2024"
    },
    {
      title: "Sigma Awards - shortlist (2024)",
      organization: "Sigma Awards",
      year: "2024"
    },
    {
      title: "Prêmio Claudio Weber Abramo - Categoria Dados Abertos (2023)",
      organization: "Transparência Brasil",
      year: "2023"
    },
    {
      title: "Prêmio Claudio Weber Abramo - Categoria Investigação (2023)",
      organization: "Transparência Brasil", 
      year: "2023"
    },
    {
      title: "Premio Roche 2023 (shortlist)",
      organization: "Premio Roche",
      year: "2023"
    },
    {
      title: "Prêmio Transparência e Fiscalização Pública 2022/Câmara dos Deputados (with Fiquem Sabendo)",
      organization: "Câmara dos Deputados",
      year: "2022"
    },
    {
      title: "Premio Claudio Weber Abramo 2022 (shortlist) - Má alimentação à Brasileira (Revista Piauí and Fiquem Sabendo)",
      organization: "Transparência Brasil",
      year: "2022"
    },
    {
      title: "Sigma Awards 2022(shortlist) - Open Lux",
      organization: "Sigma Awards",
      year: "2022"
    },
    {
      title: "Sigma Awards 2022 (shortlist) - Personal portfolio",
      organization: "Sigma Awards",
      year: "2022"
    },
    {
      title: "Sigma Awards 2022 (shortlist) - Revealing the Brazilian military pension",
      organization: "Sigma Awards",
      year: "2022"
    },
    {
      title: "IREE 2021 (Honorable mention)",
      organization: "IREE",
      year: "2021"
    },
    {
      title: "Sigma Awards 2021 (shortlist) - Shedding light on government pension",
      organization: "Sigma Awards",
      year: "2021"
    },
    {
      title: "Sigma Awards 2021 (shortlist) - Chloroquine and the Brazilian Army",
      organization: "Sigma Awards",
      year: "2021"
    },
    {
      title: "Jornalismo Mosca 2021 - Solteiragate",
      organization: "Jornalismo Mosca",
      year: "2021"
    },
    {
      title: "Premio Claudio Weber Abramo 2021 (shortlist) - Solteiragate",
      organization: "Transparência Brasil",
      year: "2021"
    },
    {
      title: "Sigma Awards 2019 (shortlist) - Personal portfolio",
      organization: "Sigma Awards",
      year: "2019"
    },
    {
      title: "Premio Claudio Weber Abramo 2019 - Newsletter Don't 'LAI' to me",
      organization: "Transparência Brasil",
      year: "2019"
    },
    {
      title: "Premio Estado de Jornalismo 2018 (Categoria Reportagem, 2nd place) - A rede bolsonarista de desinformação",
      organization: "Estado de São Paulo",
      year: "2018"
    },
    {
      title: "Premio ANPR 2018 (Honorable mention) - Fraude em cotas raciais",
      organization: "ANPR",
      year: "2018"
    },
    {
      title: "Premio Estado de Jornalismo 2018 (Categoria Serviço) - Estadão Verifica",
      organization: "Estado de São Paulo",
      year: "2018"
    },
    {
      title: "Premio Estado de Jornalismo 2017 (Categoria Reportagem, 2nd place) - Fraude em transparência em SP",
      organization: "Estado de São Paulo",
      year: "2017"
    },
    {
      title: "Premio Estado de Jornalismo 2017 (Categoria Reportagem, 3rd place) - Internações psiquiátricas (série)",
      organization: "Estado de São Paulo",
      year: "2017"
    },
    {
      title: "Premio ANPR 2017 - Denunciando uma rede de pornografia infantil",
      organization: "ANPR",
      year: "2017"
    },
    {
      title: "Premio Alianz Ayrton Senna 2016 - O fechamento de escolas em SP",
      organization: "Instituto Ayrton Senna",
      year: "2016"
    },
    {
      title: "Premio ASI/Schaeffler (Categoria Estudante) 2011 - A história da mulher que adotou seis crianças (internship)",
      organization: "ASI/Schaeffler",
      year: "2011"
    }
  ]

  const fellowships = [
    {
      title: "Together for Conservation (EJN, 2024)",
      organization: "Earth Journalism Network",
      year: "2024"
    },
    {
      title: "National Endowment for Democracy (NED) - Reagan-Fascell fellowship (2023-2024)",
      organization: "NED",
      year: "2023-2024"
    },
    {
      title: "Fondo para investigaciones y nuevas narrativas sobre drogas - Fundación Gabo (2023)",
      organization: "Fundación Gabo",
      year: "2023"
    },
    {
      title: "Gateway Grant - Muckrock Foundation (2023)",
      organization: "Muckrock Foundation",
      year: "2023"
    },
    {
      title: "Biodiversity Story Grant - Earth Journalism Network / Internews (2023), with Data Fixers",
      organization: "Earth Journalism Network",
      year: "2023"
    },
    {
      title: "Muckrock/Gateway Grant (Filecoin Foundation for the Decentralized Web) 2022, with Fiquem Sabendo and Data Fixers",
      organization: "Filecoin Foundation",
      year: "2022"
    },
    {
      title: "Google News Initiative (GNI) Startups Lab 2022, with Fiquem Sabendo",
      organization: "Google",
      year: "2022"
    },
    {
      title: "Magic Grant recipient 2022-2023 - Brown Institute for Media Innovation (Columbia/Stanford)",
      organization: "Brown Institute",
      year: "2022-2023"
    },
    {
      title: "Person of the Year 2022 - Brazilian American Chamber of Commerce",
      organization: "Brazilian American Chamber of Commerce",
      year: "2022"
    },
    {
      title: "Columbia Journalism School (US$ 91,500 in tuition) 2021/2022",
      organization: "Columbia University",
      year: "2021-2022"
    },
    {
      title: "Reuters Institute for the Study of Journalism (University of Oxford) fellowship 2021",
      organization: "Reuters Institute",
      year: "2021"
    },
    {
      title: "ICFJ Latin America grantee 2021 - FOIA explainer",
      organization: "ICFJ",
      year: "2021"
    },
    {
      title: "ICFJ Latin America Grantee 2020 - FOIA - Brazil and US project",
      organization: "ICFJ",
      year: "2020"
    },
    {
      title: "Instituto Ling's Visionary Journalist US$ 60,000 scholarship (2019) - Jornalista de Visão",
      organization: "Instituto Ling",
      year: "2019"
    },
    {
      title: "EAESP-FGV - Full scholarship for a master of science in Public Administration (2019)",
      organization: "FGV",
      year: "2019"
    },
    {
      title: "ICFJ Emerging Leaders Program / fellow 2018",
      organization: "ICFJ",
      year: "2018"
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <motion.nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrollY > 50 ? 'bg-white/95 backdrop-blur-sm shadow-lg' : 'bg-white'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center py-4 relative">
            <div className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeSection === item.id 
                      ? 'bg-red-600 text-white' 
                      : 'text-slate-700 hover:bg-red-50 hover:text-red-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item.icon && <item.icon size={16} />}
                  <span>{item.label}</span>
                </motion.button>
              ))}
            </div>
            
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 absolute right-0"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className="md:hidden bg-white border-t border-slate-200"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="px-4 py-2 space-y-2">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="flex items-center space-x-2 w-full px-3 py-2 rounded-lg text-left hover:bg-slate-100"
                  >
                    {item.icon && <item.icon size={18} />}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Hero Section */}
      <section id="home" className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                <span className="text-slate-900">I'm </span>
                <span className="text-red-600">Luiz Fernando Toledo,</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-4xl mx-auto mb-8 leading-relaxed">
                {t.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
              </div>
            </motion.div>
          </div>

          {/* GIF Section with Progress Bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex justify-center mb-8"
          >
            <div className="relative w-full max-w-md">
              {/* Progress Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-2xl z-10">
                <div 
                  className="h-full bg-red-600 rounded-t-2xl transition-all duration-100 ease-linear"
                  style={{
                    width: `${gifProgress}%`
                  }}
                ></div>
              </div>
              <img 
                src="/luiz-video-new.gif"
                alt="Luiz Fernando Toledo presentation"
                className="w-full h-80 object-cover object-center rounded-2xl shadow-2xl"
                style={{ objectPosition: 'center 20%' }}
              />
            </div>
          </motion.div>

          {/* Curriculum Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex justify-center mb-16"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant="outline"
                size="lg" 
                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-8 py-3 text-lg rounded-full"
                onClick={() => window.open('https://www.canva.com/design/DAFconHz44U/CZU35L_Irnbvr5sF28DRpg/edit?utm_content=DAFconHz44U&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton', '_blank')}
              >
                {t.curriculum}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Impact Cards Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {impactCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-red-600 text-lg">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {card.description.split(/(\w+)/).map((word, i) => {
                        const link = card.links.find(l => l.text === word)
                        return link ? (
                          <a 
                            key={i} 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-red-600 hover:text-red-800 underline font-medium"
                          >
                            {word}
                          </a>
                        ) : word
                      })}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Investigative Reporting Section */}
      <section id="investigative" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Investigative Reporting
            </h2>
            <div className="w-24 h-1 bg-red-600 mx-auto"></div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {investigativeStories.map((story, index) => (
              <motion.div
                key={story.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg overflow-hidden">
                  {story.image && (
                    <div className="aspect-video overflow-hidden">
                      <img 
                        src={story.image} 
                        alt={story.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {story.publication.split(' • ').map((pub, i) => (
                        <Badge key={i} variant="secondary" className="bg-red-100 text-red-800 text-xs">
                          {pub}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="text-lg leading-tight">{story.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-slate-600 mb-4 text-sm leading-relaxed">
                      {story.description}
                    </CardDescription>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(story.link, '_blank')}
                        className="w-full justify-between hover:bg-red-50 hover:border-red-200 text-xs"
                      >
                        {story.linkText}
                        <ExternalLink size={14} />
                      </Button>
                      {story.additionalLink && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(story.additionalLink, '_blank')}
                          className="w-full justify-between hover:bg-red-50 hover:border-red-200 text-xs"
                        >
                          {story.additionalLinkText}
                          <ExternalLink size={14} />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workshops and Interviews Section */}
      <section id="workshops" className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Interviews
            </h2>
            <div className="w-24 h-1 bg-red-600 mx-auto"></div>
          </motion.div>

          {/* Interviews Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="bg-white rounded-lg shadow-lg p-8">
              {currentInterview === 0 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">Bellingcat's Stage Talks</h3>
                  <p className="text-slate-600 mb-6">I was interviewed by Bellingcat to discuss how to use public records and data to investigate environmental crimes in Brazil. Held in English.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      src="https://open.spotify.com/embed/episode/4qtV3XWFUwFtan4jThFKX1?utm_source=generator" 
                      width="100%" 
                      height="352" 
                      frameBorder="0" 
                      allowfullscreen="" 
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                      loading="lazy"
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}
              
              {currentInterview === 1 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">Global Investigative Journalism Conference (GIJC)</h3>
                  <p className="text-slate-600 mb-6">Panel discussion on investigating environmental crimes at GIJC 2023 in Gothenburg, Sweden.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      width="100%" 
                      height="400" 
                      src="https://www.youtube.com/embed/urDaCInPdvY" 
                      title="Investigations with public records: Presenting Data Fixers at the GIJC" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {currentInterview === 2 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">SBT News</h3>
                  <p className="text-slate-600 mb-6">Discussion about transparency and investigative journalism in Brazil.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      width="100%" 
                      height="400" 
                      src="https://www.youtube.com/embed/rqvT39YIsP0" 
                      title="SBT News Interview" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {currentInterview === 3 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">TV Globo/G1 Podcast (O Assunto)</h3>
                  <p className="text-slate-600 mb-6">Podcast discussion about corporate expenses investigation.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      src="https://open.spotify.com/embed/episode/1UsnrR0DjRKHyd1fPlVtmn?utm_source=generator" 
                      width="100%" 
                      height="352" 
                      frameBorder="0" 
                      allowfullscreen="" 
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                      loading="lazy"
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {currentInterview === 4 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">FIL Lisbon Conference</h3>
                  <p className="text-slate-600 mb-6">Presentation about DataFixers.org at the Lisbon International Fair.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      width="100%" 
                      height="400" 
                      src="https://www.youtube.com/embed/dw5q9ZXMaWE" 
                      title="DataFixers.org Presentation" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {currentInterview === 5 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">CNN Brasil</h3>
                  <p className="text-slate-600 mb-6">Interview about air charter investigation and transparency in government spending.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      width="100%" 
                      height="400" 
                      src="https://www.youtube.com/embed/PP8bv7osKMo" 
                      title="CNN Brasil Interview" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {currentInterview === 6 && (
                <div>
                  <h3 className="text-2xl font-bold text-red-600 mb-4">TV Cultura</h3>
                  <p className="text-slate-600 mb-6">Discussion about transparency policies and access to information in Brazil.</p>
                  <div className="aspect-video mb-6">
                    <iframe 
                      width="100%" 
                      height="400" 
                      src="https://www.youtube.com/embed/j9zzNg8N-BA?start=2503" 
                      title="TV Cultura Interview" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentInterview(prev => prev > 0 ? prev - 1 : 6)}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                
                <span className="text-slate-600 font-medium">
                  {currentInterview + 1} / 7
                </span>
                
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentInterview(prev => prev < 6 ? prev + 1 : 0)}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Awards Section */}
      <section id="awards" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Awards and Honorable Mentions
            </h2>
            <div className="w-24 h-1 bg-red-600 mx-auto"></div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {realAwards.map((award, index) => (
              <motion.div
                key={award.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                        {award.year}
                      </Badge>
                      <Award className="text-yellow-600" size={20} />
                    </div>
                    <CardTitle className="text-sm leading-tight">{award.title}</CardTitle>
                    <p className="text-xs text-red-600 font-medium">{award.organization}</p>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Fellowships and Grants */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
              Scholarships, Fellowships and Grants
            </h3>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fellowships.map((fellowship, index) => (
              <motion.div
                key={fellowship.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                        {fellowship.year}
                      </Badge>
                      <GraduationCap className="text-blue-600" size={20} />
                    </div>
                    <CardTitle className="text-sm leading-tight">{fellowship.title}</CardTitle>
                    <p className="text-xs text-red-600 font-medium">{fellowship.organization}</p>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Modal */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setIsVideoModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors"
              >
                <X size={32} />
              </button>
              <video 
                controls
                autoPlay
                className="w-full rounded-lg shadow-2xl"
                onLoadedData={(e) => {
                  e.target.currentTime = 0; // Start from beginning in modal
                }}
              >
                <source src="/luiz-video.mov" type="video/mp4" />
                <source src="/luiz-video.mov" type="video/quicktime" />
                Your browser does not support the video tag.
              </video>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Get in Touch</h3>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Interested in collaboration, have a story tip, or want to discuss investigative journalism? I'd love to hear from you.
            </p>
            <div className="flex justify-center space-x-6 mb-8">
              <motion.a
                href="mailto:lft29@cam.ac.uk"
                className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Mail size={24} />
              </motion.a>
              <motion.a
                href="https://twitter.com/toledoluizf"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Twitter size={24} />
              </motion.a>
              <motion.a
                href="https://linkedin.com/in/luizftoledo1"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Linkedin size={24} />
              </motion.a>
            </div>
            <div className="border-t border-slate-700 pt-8">
              <p className="text-slate-400">
                © 2025 Luiz Fernando Toledo. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App

