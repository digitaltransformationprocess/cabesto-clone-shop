# -*- coding: utf-8 -*-
"""Generate Cabesto Mini POC PowerPoint (aligned with the detailed POC brief)."""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# French via unicode escapes so the file stays encoding-safe
def u(s: str) -> str:
    return s.encode("utf-8").decode("utf-8")

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

NAVY = RGBColor(0x0B, 0x1F, 0x3A)
NAVY2 = RGBColor(0x14, 0x2F, 0x52)
ORANGE = RGBColor(0xE8, 0x6B, 0x1A)
ORANGE_LT = RGBColor(0xF5, 0xA6, 0x5B)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT = RGBColor(0xF4, 0xF7, 0xFB)
MUTED = RGBColor(0x5A, 0x6B, 0x7D)
DARK = RGBColor(0x1A, 0x1A, 0x1A)
GREEN = RGBColor(0x1B, 0x7A, 0x4E)

blank = prs.slide_layouts[6]
TOTAL = 17


def add_rect(slide, l, t, w, h, fill):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, l, t, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    return sh


def add_round(slide, l, t, w, h, fill):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, l, t, w, h)
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    return sh


def set_run(run, size=18, bold=False, color=DARK):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = "Calibri"


def add_text(slide, l, t, w, h, text, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    set_run(run, size=size, bold=bold, color=color)
    return box


def add_bullets(slide, l, t, w, h, items, size=14, color=DARK, spacing=8):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(spacing)
        run = p.add_run()
        run.text = "-  " + item
        set_run(run, size=size, color=color)
    return box


def header_bar(slide, title, subtitle=None):
    add_rect(slide, 0, 0, prs.slide_width, Inches(1.05), NAVY)
    add_rect(slide, 0, Inches(1.05), prs.slide_width, Inches(0.06), ORANGE)
    add_text(slide, Inches(0.5), Inches(0.22), Inches(10), Inches(0.45), title, size=24, bold=True, color=WHITE)
    if subtitle:
        add_text(slide, Inches(0.5), Inches(0.62), Inches(11), Inches(0.35), subtitle, size=13, color=ORANGE_LT)
    add_text(
        slide,
        Inches(11.0),
        Inches(0.35),
        Inches(2.0),
        Inches(0.4),
        "Mini POC Cabesto",
        size=11,
        bold=True,
        color=ORANGE_LT,
        align=PP_ALIGN.RIGHT,
    )


def footer(slide, page):
    add_text(
        slide,
        Inches(0.5),
        Inches(7.1),
        Inches(10),
        Inches(0.3),
        "Cabesto - Mini POC chatbot  |  Document de travail  |  Confidentiel",
        size=10,
        color=MUTED,
    )
    add_text(
        slide,
        Inches(11.5),
        Inches(7.1),
        Inches(1.5),
        Inches(0.3),
        f"{page} / {TOTAL}",
        size=10,
        color=MUTED,
        align=PP_ALIGN.RIGHT,
    )


# ----- helpers for french strings (explicit unicode) -----
# Accents written as \uXXXX so PowerShell / editors cannot corrupt them.

T = {
    "title_sub": "Mini POC d\u00e9taill\u00e9 : parcours client, commande, logistique et SAV",
    "agenda": "Agenda",
    "ctx": "1. Contexte et objectifs",
    "quatre": "2. Les quatre workflows",
    "accueil": "3. \u00c9cran d\u2019accueil et exemples",
    "archi": "4. Architecture et cheminement d\u2019un message",
    "exemples": "5. Exemples de dialogues",
    "livre": "6. Ce qui est d\u00e9montrable",
    "reste": "7. Reste \u00e0 faire et suites",
}


# ========== 1 TITLE ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, NAVY)
add_rect(s, 0, Inches(5.8), prs.slide_width, Inches(1.7), NAVY2)
add_rect(s, 0, Inches(5.8), prs.slide_width, Inches(0.08), ORANGE)
add_text(s, Inches(0.8), Inches(1.5), Inches(11), Inches(0.4), "CABESTO", size=18, bold=True, color=ORANGE_LT)
add_text(s, Inches(0.8), Inches(2.0), Inches(11.5), Inches(0.7), "E-commerce Chatbot", size=40, bold=True, color=WHITE)
add_text(
    s,
    Inches(0.8),
    Inches(2.9),
    Inches(11.5),
    Inches(1.2),
    "Mini POC d\u00e9taill\u00e9\nParcours client, commande, logistique et SAV",
    size=22,
    color=RGBColor(0xC8, 0xD4, 0xE4),
)
add_text(
    s,
    Inches(0.8),
    Inches(6.15),
    Inches(10),
    Inches(0.8),
    "Pr\u00e9sentation de l\u2019\u00e9tat d\u2019avancement  \u00b7  Align\u00e9e sur le document de travail\nVersion d\u00e9taill\u00e9e  \u00b7  Octobre 2026",
    size=14,
    color=ORANGE_LT,
)
add_text(s, Inches(11), Inches(6.9), Inches(1.8), Inches(0.3), f"1 / {TOTAL}", size=11, color=MUTED, align=PP_ALIGN.RIGHT)

# ========== 2 AGENDA ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Agenda", "Selon la trame du mini POC d\u00e9taill\u00e9")
items = [
    ("01", "Contexte, objectifs et p\u00e9rim\u00e8tre"),
    ("02", "Les quatre workflows (A \u00e0 D)"),
    ("03", "\u00c9cran d\u2019accueil et exemples d\u2019usage"),
    ("04", "Architecture : du message \u00e0 la r\u00e9ponse"),
    ("05", "Ce qui est d\u00e9montrable aujourd\u2019hui"),
    ("06", "Reste \u00e0 faire, KPI et suites"),
]
for i, (num, label) in enumerate(items):
    row, col = divmod(i, 3)
    x = Inches(0.55 + col * 4.15)
    y = Inches(1.55 + row * 2.4)
    add_round(s, x, y, Inches(3.9), Inches(2.0), WHITE)
    add_text(s, x + Inches(0.25), y + Inches(0.4), Inches(3.4), Inches(0.5), num, size=28, bold=True, color=ORANGE)
    add_text(s, x + Inches(0.25), y + Inches(1.05), Inches(3.4), Inches(0.7), label, size=15, bold=True, color=NAVY)
footer(s, 2)

# ========== 3 CONTEXT ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Contexte et objectifs", "Section 1 du document de travail")
add_round(s, Inches(0.5), Inches(1.35), Inches(6.05), Inches(5.35), WHITE)
add_text(s, Inches(0.7), Inches(1.5), Inches(5.6), Inches(0.35), "Contexte Cabesto", size=16, bold=True, color=ORANGE)
add_bullets(
    s,
    Inches(0.7),
    Inches(2.0),
    Inches(5.6),
    Inches(4.4),
    [
        "Enseigne de loisirs (mer, montagne, alimentation, piscine)",
        "Magasins + site cabesto.com - catalogue tr\u00e8s diversifi\u00e9",
        "Besoins clients : choisir un produit, d\u00e9lais, suivi, retour",
        "Hypoth\u00e8se : beaucoup de contacts portent sur ces 3 sujets",
        "Le POC cible : choix produit, suivi commande, retours / SAV",
    ],
    size=13,
    spacing=10,
)
add_round(s, Inches(6.8), Inches(1.35), Inches(6.05), Inches(5.35), WHITE)
add_text(s, Inches(7.0), Inches(1.5), Inches(5.6), Inches(0.35), "Objectifs du POC", size=16, bold=True, color=ORANGE)
add_bullets(
    s,
    Inches(7.0),
    Inches(2.0),
    Inches(5.6),
    Inches(4.4),
    [
        "Parcours complet : question -> confirmation ou ticket SAV",
        "Fiabilit\u00e9 : prix, stock, statut toujours issus des sources",
        "Garde-fous : authentification, transfert humain, journalisation",
        "Mesurer avec des KPI d\u00e9finis \u00e0 l\u2019avance",
        "Valider la faisabilit\u00e9 avant int\u00e9gration aux syst\u00e8mes r\u00e9els",
    ],
    size=13,
    spacing=10,
)
footer(s, 3)

# ========== 4 FOUR WORKFLOWS ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Les quatre workflows du POC", "Le parcours en quatre temps")
flows = [
    ("A", "Identification\net profil", "Reconna\u00eetre le client avant toute donn\u00e9e personnelle, sans bloquer l\u2019anonyme"),
    ("B", "Recherche produit\net commande", "Trouver le bon produit en langage naturel, puis commander avec validation explicite"),
    ("C", "Suivi\nlogistique", "Statut exact, anomalies d\u00e9tect\u00e9es, ouverture d\u2019une demande si besoin"),
    ("D", "Retours et\nr\u00e9clamations", "Qualifier, collecter les preuves, cr\u00e9er un ticket complet, informer le client"),
]
for i, (letter, title, desc) in enumerate(flows):
    x = Inches(0.4 + i * 3.2)
    add_round(s, x, Inches(1.45), Inches(3.0), Inches(5.2), WHITE)
    add_rect(s, x, Inches(1.45), Inches(3.0), Inches(0.9), ORANGE if i % 2 == 0 else NAVY)
    add_text(s, x, Inches(1.55), Inches(3.0), Inches(0.7), letter, size=28, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.15), Inches(2.55), Inches(2.7), Inches(1.0), title, size=16, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.2), Inches(3.8), Inches(2.6), Inches(2.4), desc, size=13, color=MUTED, align=PP_ALIGN.CENTER)
footer(s, 4)

# ========== 5 HOME + EXAMPLES ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "\u00c9cran d\u2019accueil - boutons et intentions", "Section 2 : ce que d\u00e9clenche chaque action")
rows = [
    ("Trouver un produit", "Recherche produit (B)", "\u00ab Que cherchez-vous ? Usage, niveau, budget\u2026 \u00bb"),
    ("Suivre ma commande", "Identification puis suivi (A+C)", "\u00ab Pour retrouver votre commande, je dois vous identifier. \u00bb"),
    ("Livraison et d\u00e9lais", "Information (+ B ou C)", "Modes de livraison, d\u00e9lais, ou suivi d\u2019une commande"),
    ("Retour ou r\u00e9clamation", "Identification puis SAV (A+D)", "\u00ab Je suis d\u00e9sol\u00e9 pour ce souci. Identifions-nous d\u2019abord. \u00bb"),
    ("Parler \u00e0 un conseiller", "Transfert humain", "Toujours visible ; r\u00e9sum\u00e9 de l\u2019\u00e9change joint au ticket"),
    ("Saisie libre", "Intention d\u00e9tect\u00e9e", "Reformulation + clarification si besoin"),
]
add_round(s, Inches(0.45), Inches(1.3), Inches(12.4), Inches(5.5), WHITE)
for i, (btn, wf, msg) in enumerate(rows):
    y = Inches(1.5 + i * 0.82)
    add_round(s, Inches(0.65), y, Inches(3.3), Inches(0.65), NAVY)
    add_text(s, Inches(0.75), y + Inches(0.15), Inches(3.1), Inches(0.4), btn, size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(4.15), y + Inches(0.15), Inches(3.5), Inches(0.4), wf, size=12, bold=True, color=ORANGE)
    add_text(s, Inches(7.7), y + Inches(0.1), Inches(4.9), Inches(0.55), msg, size=12, color=DARK)
footer(s, 5)

# ========== 6 EXAMPLE PRODUCT / STORE ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Exemples - trouver un produit / un magasin", "Dialogues types pour la d\u00e9monstration")
add_round(s, Inches(0.45), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(0.65), Inches(1.45), Inches(5.7), Inches(0.35), "Exemple 1 - Trouver un produit", size=15, bold=True, color=ORANGE)
add_bullets(
    s,
    Inches(0.65),
    Inches(1.95),
    Inches(5.7),
    Inches(4.6),
    [
        "Client : \u00ab Je cherche un masque de snorkeling pour adulte \u00bb",
        "Assistant : usage (mer / piscine) + budget ?",
        "Client : \u00ab Mer, vacances. Autour de 30 \u20ac \u00bb",
        "Assistant : 2 options max. avec raison, prix et stock",
        "Client : choisit un article -> ajout panier",
        "Suite : adresse, mode de livraison, \u00ab Je confirme \u00bb",
    ],
    size=12,
    spacing=9,
)
add_round(s, Inches(6.8), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(7.0), Inches(1.45), Inches(5.7), Inches(0.35), "Exemple 2 - Trouver un magasin", size=15, bold=True, color=ORANGE)
add_bullets(
    s,
    Inches(7.0),
    Inches(1.95),
    Inches(5.7),
    Inches(4.6),
    [
        "Client : \u00ab Y a-t-il un magasin Cabesto \u00e0 Aubagne ? \u00bb",
        "Assistant : adresse, t\u00e9l\u00e9phone, univers du magasin",
        "Client : \u00ab Quels magasins autour de Marseille ? \u00bb",
        "Assistant : liste courte + lien page magasins",
        "Client : \u00ab Horaires du magasin de Montpellier \u00bb",
        "R\u00e8gle : r\u00e9ponse issue de la page magasins, pas invent\u00e9e",
    ],
    size=12,
    spacing=9,
)
footer(s, 6)

# ========== 7 MORE EXAMPLES ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Autres exemples de questions clients", "Couvrir le p\u00e9rim\u00e8tre du document")
examples = [
    ("Livraison", "\u00ab Quels sont les d\u00e9lais de livraison ? \u00bb", "Modes, d\u00e9lais, frais - page livraison"),
    ("Suivi", "\u00ab O\u00f9 en est ma commande CMD-1101 ? \u00bb", "Apr\u00e8s connexion : statut exact + transporteur"),
    ("Anomalie", "\u00ab Mon colis n\u2019a pas boug\u00e9 depuis 3 jours \u00bb", "D\u00e9tection retard / suivi bloqu\u00e9 -> ticket"),
    ("Retour", "\u00ab Comment retourner un produit ? \u00bb", "Info retours (anonyme) ou SAV si r\u00e9clamation"),
    ("SAV", "\u00ab J\u2019ai re\u00e7u mon colis, le produit est cass\u00e9 \u00bb", "Motif, commande, ticket - sans promesse de remboursement"),
    ("Panier", "\u00ab Ajoute le Lagon au panier puis je commande \u00bb", "Panier -> transporteur -> confirmation explicite"),
]
for i, (tag, q, a) in enumerate(examples):
    col = i % 2
    row = i // 2
    x = Inches(0.45 + col * 6.4)
    y = Inches(1.3 + row * 1.8)
    add_round(s, x, y, Inches(6.15), Inches(1.6), WHITE)
    add_round(s, x + Inches(0.15), y + Inches(0.2), Inches(1.5), Inches(0.4), NAVY)
    add_text(s, x + Inches(0.15), y + Inches(0.25), Inches(1.5), Inches(0.35), tag, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(1.85), y + Inches(0.2), Inches(4.1), Inches(0.55), q, size=12, bold=True, color=NAVY)
    add_text(s, x + Inches(0.25), y + Inches(0.9), Inches(5.7), Inches(0.5), a, size=12, color=MUTED)
footer(s, 7)

# ========== 8 ARCHITECTURE (no vendors) ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Architecture minimale du POC", "Section 4 - sans d\u00e9pendance \u00e0 un \u00e9diteur nomm\u00e9")
blocks = [
    ("Interface chatbot", "Widget web, boutons,\ncartes produit, saisie libre"),
    ("Moteur conversationnel", "Intentions, clarification,\nr\u00e9ponses contr\u00f4l\u00e9es"),
    ("Donn\u00e9es / sources", "Catalogue, stock, commandes,\nsuivi, ticketing (test)"),
    ("S\u00e9curit\u00e9 & contr\u00f4le", "Auth, minimisation,\njournalisation, transfert"),
]
for i, (t, d) in enumerate(blocks):
    x = Inches(0.4 + i * 3.2)
    add_round(s, x, Inches(1.45), Inches(3.0), Inches(2.4), NAVY if i != 2 else ORANGE)
    add_text(s, x + Inches(0.15), Inches(1.7), Inches(2.7), Inches(0.5), t, size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.15), Inches(2.4), Inches(2.7), Inches(1.2), d, size=12, color=WHITE, align=PP_ALIGN.CENTER)

add_round(s, Inches(0.5), Inches(4.2), Inches(12.3), Inches(2.5), WHITE)
add_text(s, Inches(0.75), Inches(4.35), Inches(11.8), Inches(0.35), "Principe cl\u00e9 (doc)", size=15, bold=True, color=ORANGE)
add_text(
    s,
    Inches(0.75),
    Inches(4.85),
    Inches(11.8),
    Inches(1.5),
    "Le mod\u00e8le de langage comprend et formule.\n"
    "Il ne d\u00e9cide ni du prix, ni du stock, ni du statut, ni de la date de livraison :\n"
    "ces informations viennent des syst\u00e8mes sources (API / donn\u00e9es de test).",
    size=15,
    color=DARK,
)
footer(s, 8)

# ========== 9 MESSAGE PATH / RAG without tool names ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Cheminement d\u2019un message", "Section 4.2 - de la question \u00e0 la r\u00e9ponse fiable")
steps = [
    ("1", "R\u00e9ception", "Message client"),
    ("2", "Compr\u00e9hension", "Intention + infos cl\u00e9s"),
    ("3", "Droits", "Auth requise ?"),
    ("4", "Sources", "Catalogue / docs /\ncommande / ticket"),
    ("5", "Formulation", "R\u00e9ponse \u00e0 partir\ndes seules donn\u00e9es"),
    ("6", "Contr\u00f4le", "Garde-fous +\njournalisation"),
]
for i, (n, t, d) in enumerate(steps):
    x = Inches(0.35 + i * 2.15)
    add_round(s, x, Inches(1.5), Inches(2.0), Inches(2.7), WHITE)
    circ = s.shapes.add_shape(MSO_SHAPE.OVAL, x + Inches(0.65), Inches(1.7), Inches(0.7), Inches(0.7))
    circ.fill.solid()
    circ.fill.fore_color.rgb = ORANGE
    circ.line.fill.background()
    add_text(s, x + Inches(0.65), Inches(1.8), Inches(0.7), Inches(0.5), n, size=16, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.1), Inches(2.55), Inches(1.8), Inches(0.4), t, size=13, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.1), Inches(3.05), Inches(1.8), Inches(0.9), d, size=11, color=MUTED, align=PP_ALIGN.CENTER)

add_round(s, Inches(0.5), Inches(4.5), Inches(12.3), Inches(2.2), WHITE)
add_text(s, Inches(0.75), Inches(4.65), Inches(11.8), Inches(0.35), "Base de connaissance du POC (anonyme)", size=14, bold=True, color=ORANGE)
add_bullets(
    s,
    Inches(0.75),
    Inches(5.1),
    Inches(11.8),
    Inches(1.4),
    [
        "Catalogue produits index\u00e9 (texte des fiches) + prix / stock relus au moment de l\u2019affichage",
        "Pages site : FAQ, livraison, retours, magasins, CGV - pour r\u00e9pondre avec des extraits et des liens",
        "Si aucune source utile : \u00ab Je ne sais pas \u00bb + proposition de conseiller",
    ],
    size=13,
    spacing=7,
)
footer(s, 9)

# ========== 10 INDEX PIPELINE generic ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Pr\u00e9paration de la base de connaissance", "Premi\u00e8re \u00e9tape : sources -> index -> recherche")
pipe = [
    ("Sources", "Fiches produits\nPages info &\nmagasins"),
    ("D\u00e9coupage", "Blocs textuels\npar section\n(sans prix/stock)"),
    ("Indexation", "Repr\u00e9sentation\nvectorielle\npour la recherche"),
    ("Recherche", "Question client\n-> extraits\nles plus proches"),
    ("Hydratation", "Prix, stock,\nimage lus en\ntemps r\u00e9el"),
    ("R\u00e9ponse", "Formulation\ncontr\u00f4l\u00e9e +\ncartes produit"),
]
for i, (t, d) in enumerate(pipe):
    x = Inches(0.35 + i * 2.15)
    add_round(s, x, Inches(1.5), Inches(2.0), Inches(3.2), WHITE)
    add_rect(s, x, Inches(1.5), Inches(2.0), Inches(0.7), ORANGE if i in (0, 5) else NAVY)
    add_text(s, x, Inches(1.6), Inches(2.0), Inches(0.5), t, size=13, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.1), Inches(2.5), Inches(1.8), Inches(1.9), d, size=12, color=DARK, align=PP_ALIGN.CENTER)

add_round(s, Inches(0.5), Inches(5.0), Inches(12.3), Inches(1.7), WHITE)
add_bullets(
    s,
    Inches(0.75),
    Inches(5.2),
    Inches(11.8),
    Inches(1.3),
    [
        "Pourquoi s\u00e9parer prix/stock de l\u2019index ? Pour \u00e9viter d\u2019afficher une donn\u00e9e obsol\u00e8te invent\u00e9e par le mod\u00e8le.",
        "Les parcours compte (suivi, SAV) s\u2019appuient sur les commandes / tickets du profil connect\u00e9, pas sur la recherche catalogue.",
    ],
    size=13,
    spacing=8,
)
footer(s, 10)

# ========== 11 AUTH + PERIMETER ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Identification et p\u00e9rim\u00e8tre", "Workflow A + tableau \u00ab ce qui est autoris\u00e9 \u00bb")
add_round(s, Inches(0.45), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(0.65), Inches(1.45), Inches(5.7), Inches(0.35), "Anonyme - autoris\u00e9", size=15, bold=True, color=GREEN)
add_bullets(
    s,
    Inches(0.65),
    Inches(2.0),
    Inches(5.7),
    Inches(4.5),
    [
        "Trouver un produit (prix, stock, photo)",
        "Infos livraison, retours, FAQ",
        "Trouver un magasin / une ville",
        "Panier (sans commande li\u00e9e au compte)",
        "Interdit : voir une commande, ticket SAV li\u00e9",
    ],
    size=13,
    spacing=10,
)
add_round(s, Inches(6.8), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(7.0), Inches(1.45), Inches(5.7), Inches(0.35), "Connect\u00e9 - autoris\u00e9", size=15, bold=True, color=ORANGE)
add_bullets(
    s,
    Inches(7.0),
    Inches(2.0),
    Inches(5.7),
    Inches(4.5),
    [
        "Suivre une commande (statut source)",
        "Retour / r\u00e9clamation + cr\u00e9ation ticket",
        "Checkout conversationnel avec confirmation",
        "Handoff conseiller avec r\u00e9sum\u00e9",
        "Dans le POC : connexion site (OTP non impos\u00e9)",
    ],
    size=13,
    spacing=10,
)
footer(s, 11)

# ========== 12 DELIVERED ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Ce qui est d\u00e9montrable aujourd\u2019hui", "Alignement avec les 4 workflows du document")
done = [
    ("B - Produit", "Recherche langage naturel, cartes (photo, prix, stock), ajout panier"),
    ("B - Commande", "Panier chat, choix transporteur, confirmation explicite, r\u00e9f\u00e9rence"),
    ("Info site", "Livraison, retours, FAQ, magasins (ex. ville) via pages index\u00e9es"),
    ("A - Acc\u00e8s compte", "Gate login avant suivi / SAV ; reprise du besoin apr\u00e8s connexion"),
    ("C - Suivi", "Num\u00e9ro de commande (ex. CMD-1101), statut multi-\u00e9tats, pas d\u2019invention"),
    ("D - SAV guid\u00e9", "Commande -> motif -> d\u00e9tails -> ticket ; m\u00e9moire de parcours"),
    ("Transfert", "Parler \u00e0 un conseiller + r\u00e9sum\u00e9 ; 2 \u00e9checs -> proposition humaine"),
    ("Garde-fous", "Pas de promesse de remboursement ; pas de tableau invent\u00e9 de prix"),
]
for i, (t, d) in enumerate(done):
    col = i % 2
    row = i // 2
    x = Inches(0.45 + col * 6.4)
    y = Inches(1.3 + row * 1.35)
    add_round(s, x, y, Inches(6.15), Inches(1.2), WHITE)
    add_text(s, x + Inches(0.2), y + Inches(0.15), Inches(0.45), Inches(0.4), "OK", size=12, bold=True, color=GREEN)
    add_text(s, x + Inches(0.7), y + Inches(0.15), Inches(5.2), Inches(0.35), t, size=14, bold=True, color=NAVY)
    add_text(s, x + Inches(0.7), y + Inches(0.55), Inches(5.2), Inches(0.5), d, size=12, color=MUTED)
footer(s, 12)

# ========== 13 DEMO SCENARIOS ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Sc\u00e9narios de d\u00e9monstration (10-12 min)", "Section 6 du document")
sc = [
    ("1. Achat assist\u00e9 (~3 min)", [
        "Recherche produit fictif + clarification",
        "2 options avec raison / prix / stock",
        "Panier + confirmation explicite",
        "Cas limite : produit en rupture -> alternatives",
    ]),
    ("2. Suivi de commande (~2 min)", [
        "Client connect\u00e9 + n\u00b0 de commande",
        "Statut = donn\u00e9e source (100 %)",
        "Fen\u00eatre / transporteur si disponible",
        "Cas limite : retard -> proposition ticket",
    ]),
    ("3. R\u00e9clamation (~3 min)", [
        "Colis endommag\u00e9 / motif qualifi\u00e9",
        "S\u00e9lection commande + description",
        "Ticket avec champs structur\u00e9s",
        "Cas limite : hors r\u00e8gles -> conseiller",
    ]),
]
for i, (title, bullets) in enumerate(sc):
    x = Inches(0.4 + i * 4.25)
    add_round(s, x, Inches(1.4), Inches(4.05), Inches(5.3), WHITE)
    add_rect(s, x, Inches(1.4), Inches(4.05), Inches(0.85), NAVY if i != 1 else ORANGE)
    add_text(s, x + Inches(0.15), Inches(1.55), Inches(3.75), Inches(0.6), title, size=14, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_bullets(s, x + Inches(0.25), Inches(2.5), Inches(3.55), Inches(3.8), bullets, size=13, spacing=12)
footer(s, 13)

# ========== 14 REMAINING ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Reste \u00e0 faire (vs document)", "\u00c9carts par rapport au mini POC d\u00e9taill\u00e9")
left = [
    "OTP email/SMS (le POC actuel utilise la connexion site)",
    "Photos / pi\u00e8ces jointes dans le parcours SAV",
    "Paiement sandbox h\u00e9berg\u00e9 (confirmation simul\u00e9e aujourd\u2019hui)",
    "Tableau de bord KPI (journal d\u2019\u00e9v\u00e9nements d\u00e9j\u00e0 amorc\u00e9)",
    "Notifications email \u00e0 chaque \u00e9tape du ticket",
]
right = [
    "Jeu de recette ~30 cas + mesure des 5 KPI",
    "R\u00e8gles d\u2019\u00e9ligibilit\u00e9 retours valid\u00e9es avec juridique",
    "Int\u00e9grations r\u00e9elles (lecture seule) post go",
    "Canal WhatsApp : hors p\u00e9rim\u00e8tre POC (apr\u00e8s)",
    "Multilingue : hors p\u00e9rim\u00e8tre (fran\u00e7ais seulement)",
]
add_round(s, Inches(0.45), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(0.65), Inches(1.45), Inches(5.7), Inches(0.35), "Fonctionnel encore partiel", size=15, bold=True, color=ORANGE)
add_bullets(s, Inches(0.65), Inches(2.0), Inches(5.7), Inches(4.5), left, size=13, spacing=11)
add_round(s, Inches(6.8), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(7.0), Inches(1.45), Inches(5.7), Inches(0.35), "Cadrage / industrialisation", size=15, bold=True, color=ORANGE)
add_bullets(s, Inches(7.0), Inches(2.0), Inches(5.7), Inches(4.5), right, size=13, spacing=11)
footer(s, 14)

# ========== 15 KPI ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "KPI de succ\u00e8s (propositions du document)", "Section 7 - cibles \u00e0 ajuster avec Cabesto")
kpis = [
    ("Exp\u00e9rience", "Taux de parcours termin\u00e9s", ">= 90 %"),
    ("Commerce", "Ajout panier apr\u00e8s recommandation", ">= 40 %*"),
    ("Service", "R\u00e9solution sans conseiller", ">= 70 %"),
    ("Logistique", "Exactitude du statut", "100 %"),
    ("SAV", "Ticket avec tous les champs", "100 %"),
]
for i, (dim, kpi, cible) in enumerate(kpis):
    y = Inches(1.35 + i * 1.0)
    add_round(s, Inches(0.5), y, Inches(12.3), Inches(0.85), WHITE)
    add_round(s, Inches(0.7), y + Inches(0.18), Inches(2.4), Inches(0.5), NAVY)
    add_text(s, Inches(0.7), y + Inches(0.25), Inches(2.4), Inches(0.4), dim, size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    add_text(s, Inches(3.4), y + Inches(0.25), Inches(6.5), Inches(0.4), kpi, size=15, bold=True, color=NAVY)
    add_text(s, Inches(10.2), y + Inches(0.25), Inches(2.3), Inches(0.4), cible, size=16, bold=True, color=ORANGE, align=PP_ALIGN.RIGHT)
add_text(
    s,
    Inches(0.5),
    Inches(6.5),
    Inches(12),
    Inches(0.4),
    "* indicatif en test  |  Indicateur transversal : 0 donn\u00e9e invent\u00e9e (prix / stock / statut)",
    size=12,
    color=MUTED,
)
footer(s, 15)

# ========== 16 PERIMETER ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, LIGHT)
header_bar(s, "Dans / hors p\u00e9rim\u00e8tre", "Section 1.3 du document")
add_round(s, Inches(0.45), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(0.65), Inches(1.45), Inches(5.7), Inches(0.35), "Dans le p\u00e9rim\u00e8tre", size=16, bold=True, color=GREEN)
add_bullets(
    s,
    Inches(0.65),
    Inches(2.0),
    Inches(5.7),
    Inches(4.5),
    [
        "Widget web responsive (site + mobile web)",
        "4 workflows : ID, produit/commande, suivi, SAV",
        "Donn\u00e9es / commandes / profils fictifs",
        "Paiement simul\u00e9 (ou page de test)",
        "Tickets de test + transfert conseiller (simul\u00e9)",
    ],
    size=13,
    spacing=11,
)
add_round(s, Inches(6.8), Inches(1.3), Inches(6.1), Inches(5.5), WHITE)
add_text(s, Inches(7.0), Inches(1.45), Inches(5.7), Inches(0.35), "Hors p\u00e9rim\u00e8tre", size=16, bold=True, color=RGBColor(0xB0, 0x3A, 0x2E))
add_bullets(
    s,
    Inches(7.0),
    Inches(2.0),
    Inches(5.7),
    Inches(4.5),
    [
        "Remplacement du site / OMS / CRM",
        "Paiement r\u00e9el et donn\u00e9es bancaires",
        "Donn\u00e9es clients r\u00e9elles",
        "App native / WhatsApp (apr\u00e8s POC)",
        "Multilingue ; gestes commerciaux hors r\u00e8gles",
    ],
    size=13,
    spacing=11,
)
footer(s, 16)

# ========== 17 CLOSING ==========
s = prs.slides.add_slide(blank)
add_rect(s, 0, 0, prs.slide_width, prs.slide_height, NAVY)
add_rect(s, 0, Inches(5.9), prs.slide_width, Inches(1.6), NAVY2)
add_rect(s, 0, Inches(5.9), prs.slide_width, Inches(0.08), ORANGE)
add_text(s, Inches(0.8), Inches(1.8), Inches(11.5), Inches(0.5), "En r\u00e9sum\u00e9", size=20, bold=True, color=ORANGE_LT)
add_text(
    s,
    Inches(0.8),
    Inches(2.5),
    Inches(11.5),
    Inches(2.5),
    "Le mini POC montre un assistant unique capable de :\n"
    "trouver un produit, un magasin, informer (livraison / retours),\n"
    "suivre une commande et ouvrir un SAV - avec des faits issus des sources,\n"
    "pas invent\u00e9s par le mod\u00e8le.",
    size=20,
    color=WHITE,
)
add_text(
    s,
    Inches(0.8),
    Inches(6.2),
    Inches(11),
    Inches(0.9),
    "Suite : finaliser OTP / photos SAV / KPI de recette, puis d\u00e9cision go / no-go.\nMerci.",
    size=15,
    color=ORANGE_LT,
)
add_text(s, Inches(11), Inches(6.9), Inches(1.8), Inches(0.3), f"{TOTAL} / {TOTAL}", size=11, color=MUTED, align=PP_ALIGN.RIGHT)

out1 = r"c:\Users\bilal\Desktop\the IA app\cabesto-clone-shop\POC-Marineo-Cabesto.pptx"
out2 = r"c:\Users\bilal\Desktop\POC-Marineo-Cabesto.pptx"
out3 = r"c:\Users\bilal\Documents\POC-Marineo-Cabesto.pptx"
prs.save(out1)
prs.save(out2)
try:
    prs.save(out3)
except OSError:
    pass
print("OK slides", len(prs.slides))
print(out1)
print(out2)
