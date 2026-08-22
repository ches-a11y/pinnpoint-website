#!/usr/bin/env python3
"""
Render a Pinnpoint x nShift monthly commission statement PDF from the
statement.json payload served by the partner feed.

Usage:  python3 build_statement.py statement.json out.pdf
"""
import json
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, Image, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)

NAVY = colors.HexColor('#1F3A5F')
INK = colors.HexColor('#0b0b0b')
INK2 = colors.HexColor('#52514e')
MUTED = colors.HexColor('#898781')
RULE = colors.HexColor('#d8d7d0')
BAND = colors.HexColor('#f4f4f1')
BENELUX = colors.HexColor('#2a78d6')
GERMANY = colors.HexColor('#eb6834')
UKI = colors.HexColor('#1baf7a')
OTHER = colors.HexColor('#898781')
REGION_COLOR = {'Benelux': BENELUX, 'Germany': GERMANY, 'UK & Ireland': UKI}

LOGO = '/tmp/pw/assets/logo.png'

ENTITY = ('Stil Creative i Malmö AB trading as Pinnpoint · Box 20054, 200 74 Malmö, Sweden · '
          'VAT SE556900839301')


FULL_MONTH = {'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
              'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
              'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'}


def month_label(label):
    """'Aug 2026' -> 'August 2026'; anything unexpected passes through."""
    parts = label.split()
    if len(parts) == 2 and parts[0] in FULL_MONTH:
        return f'{FULL_MONTH[parts[0]]} {parts[1]}'
    return label


def money(v, cur='EUR'):
    sym = '£' if cur == 'GBP' else '€'
    return f'{sym}{v:,.2f}'


def style(name, **kw):
    base = dict(fontName='Helvetica', fontSize=9.5, textColor=INK, leading=13)
    base.update(kw)
    return ParagraphStyle(name, **base)


S_TITLE = style('t', fontName='Helvetica-Bold', fontSize=19, textColor=NAVY, leading=23)
S_KICKER = style('k', fontName='Helvetica-Bold', fontSize=8, textColor=MUTED, leading=11)
S_SUB = style('s', fontSize=10, textColor=INK2, leading=14)
S_H = style('h', fontName='Helvetica-Bold', fontSize=10.5, textColor=NAVY, leading=14)
S_BODY = style('b')
S_FOOT = style('f', fontSize=7.6, textColor=MUTED, leading=10.5)
S_DUE_LAB = style('dl', fontName='Helvetica-Bold', fontSize=8.5, textColor=MUTED, leading=12)
S_DUE = style('d', fontName='Helvetica-Bold', fontSize=30, textColor=NAVY, leading=34)
S_EMPTY = style('e', fontSize=9.5, textColor=MUTED, leading=13)


def kpi_cell(label, value):
    return [Paragraph(label.upper(), S_DUE_LAB),
            Paragraph(value, style('v', fontName='Helvetica-Bold', fontSize=14, leading=18))]


def build(data, out_path):
    doc = BaseDocTemplate(out_path, pagesize=A4,
                          leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=16 * mm,
                          title=f"Pinnpoint x nShift commission statement {data['month']}",
                          author='Pinnpoint')
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
    doc.addPageTemplates([PageTemplate(id='p', frames=[frame])])

    W = doc.width
    story = []

    # ---- masthead ---------------------------------------------------------
    try:
        logo = Image(LOGO)
        ratio = logo.imageHeight / float(logo.imageWidth)
        logo.drawWidth = 38 * mm
        logo.drawHeight = 38 * mm * ratio
        left = logo
    except Exception:
        left = Paragraph('Pinnpoint', S_TITLE)

    right = Paragraph('COMMISSION STATEMENT',
                      ParagraphStyle('r', parent=S_KICKER, alignment=TA_RIGHT))
    head = Table([[left, right]], colWidths=[W * 0.55, W * 0.45])
    head.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story += [head, Spacer(1, 9)]

    bar = Table([['']], colWidths=[W], rowHeights=[2.6])
    bar.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), NAVY),
                             ('LINEBELOW', (0, 0), (-1, -1), 0, colors.white)]))
    story += [bar, Spacer(1, 12)]

    story.append(Paragraph('Pinnpoint &times; nShift', S_TITLE))
    story.append(Paragraph(
        f"Partner commission statement &nbsp;·&nbsp; <b>{month_label(data['monthLabel'])}</b>"
        f" &nbsp;·&nbsp; Benelux, Germany, UK &amp; Ireland", S_SUB))
    story.append(Paragraph(f"Generated {data['generated']}", S_FOOT))
    story.append(Spacer(1, 14))

    # ---- commission due ---------------------------------------------------
    t = data['totals']
    due = Table([[Paragraph('COMMISSION DUE', S_DUE_LAB)],
                 [Paragraph(money(t['commission']), S_DUE)],
                 [Paragraph(f"{t['commissionableBoxes']:,} commissionable boxes "
                            f"&times; &euro;{data['perBox']} per box", S_FOOT)]],
                colWidths=[W])
    due.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BAND),
        ('LEFTPADDING', (0, 0), (-1, -1), 14), ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (0, 0), 12), ('BOTTOMPADDING', (0, 2), (0, 2), 12),
        ('BOTTOMPADDING', (0, 0), (0, 1), 2), ('TOPPADDING', (0, 1), (0, 2), 0),
        ('LINEBEFORE', (0, 0), (0, -1), 3, NAVY),
    ]))
    story += [due, Spacer(1, 14)]

    # ---- month at a glance ------------------------------------------------
    kpis = Table([[kpi_cell('New leads', f"{t['leads']:,}")[0],
                   kpi_cell('Orders', f"{t['orders']:,}")[0],
                   kpi_cell('Boxes', f"{t['boxes']:,}")[0],
                   kpi_cell('Order value', money(t['revenue']))[0]],
                  [kpi_cell('New leads', f"{t['leads']:,}")[1],
                   kpi_cell('Orders', f"{t['orders']:,}")[1],
                   kpi_cell('Boxes', f"{t['boxes']:,}")[1],
                   kpi_cell('Order value', money(t['revenue']))[1]]],
                 colWidths=[W / 4.0] * 4)
    kpis.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 0), ('BOTTOMPADDING', (0, 0), (-1, 0), 1),
        ('TOPPADDING', (0, 1), (-1, 1), 0), ('BOTTOMPADDING', (0, 1), (-1, 1), 10),
        ('LINEBELOW', (0, 1), (-1, 1), 0.6, RULE),
    ]))
    story += [kpis, Spacer(1, 16)]

    # ---- by market --------------------------------------------------------
    story.append(Paragraph('By market', S_H))
    story.append(Spacer(1, 5))
    rows = [['Market', 'Orders', 'Boxes', 'Order value', 'Commission']]
    for r in data['byRegion']:
        rows.append([r['region'], f"{r['orders']:,}", f"{r['boxes']:,}",
                     money(r['revenue']), money(r['commission'])])
    rows.append(['Total', f"{t['orders']:,}", f"{t['boxes']:,}",
                 money(t['revenue']), money(t['commission'])])

    tbl = Table(rows, colWidths=[W * 0.32, W * 0.13, W * 0.13, W * 0.21, W * 0.21])
    st = [
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, 0), MUTED),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.6, RULE),
        ('LINEABOVE', (0, -1), (-1, -1), 0.9, INK),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (0, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    for i, r in enumerate(data['byRegion'], start=1):
        c = REGION_COLOR.get(r['region'], OTHER)
        st.append(('LINEBEFORE', (0, i), (0, i), 3, c))
        st.append(('LINEBELOW', (0, i), (-1, i), 0.4, RULE))
    tbl.setStyle(TableStyle(st))
    story += [tbl, Spacer(1, 16)]

    # ---- line items -------------------------------------------------------
    story.append(Paragraph('Orders in this period', S_H))
    story.append(Spacer(1, 5))
    if data['rows']:
        rows = [['Date', 'Customer', 'Market', 'Boxes', 'Value', 'Commission']]
        for r in data['rows']:
            market = (data['byRegion'][r['region']]['region']
                      if isinstance(r['region'], int) and r['region'] < len(data['byRegion'])
                      else '—')
            rows.append([r['date'], r['customer'], market, f"{r['boxes']:,}",
                         money(r['value'], r.get('currency', 'EUR')),
                         money(r['commission'])])
        li = Table(rows, colWidths=[W * 0.13, W * 0.31, W * 0.16, W * 0.10, W * 0.15, W * 0.15])
        li.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.6),
            ('TEXTCOLOR', (0, 0), (-1, 0), MUTED),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('LINEBELOW', (0, 0), (-1, 0), 0.6, RULE),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BAND]),
            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (0, -1), 8),
        ]))
        story.append(li)
    else:
        empty = Table([[Paragraph(
            'No customer orders were recorded in this period. '
            'The Netherlands campaign launches 25 August 2026; commission accrues '
            'from 1 September 2026.', S_EMPTY)]], colWidths=[W])
        empty.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BAND),
            ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 11), ('BOTTOMPADDING', (0, 0), (-1, -1), 11),
        ]))
        story.append(empty)

    story.append(Spacer(1, 20))
    line = Table([['']], colWidths=[W], rowHeights=[0.6])
    line.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), RULE)]))
    story += [line, Spacer(1, 7)]
    story.append(Paragraph(data['note'], S_FOOT))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'Live pipeline: pinnpt.com/partner-dashboard.html &nbsp;·&nbsp; ' + ENTITY, S_FOOT))

    doc.build(story)


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    with open(src) as fh:
        build(json.load(fh), out)
    print('wrote', out)
