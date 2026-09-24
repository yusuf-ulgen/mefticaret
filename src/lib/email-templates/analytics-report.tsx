import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'

interface Row { label: string; value: string }
interface Props { storeName?: string; reportLabel?: string; rangeLabel?: string; rows?: Row[]; sections?: { title: string; rows: Row[] }[] }

function AnalyticsReportEmail({ storeName, reportLabel, rangeLabel, rows = [], sections = [] }: Props) {
  return (
    <Html lang="tr" dir="ltr">
      <Head />
      <Preview>{`${storeName ?? ''} · ${reportLabel ?? 'Rapor'}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={muted}>{storeName}</Text>
          <Heading style={h1}>{reportLabel}</Heading>
          <Text style={muted}>{rangeLabel}</Text>
          {rows.map((r) => (
            <Text key={r.label} style={line}><span>{r.label}</span>: <strong>{r.value}</strong></Text>
          ))}
          {sections.map((s) => (
            <Section key={s.title} style={{ marginTop: '16px' }}>
              <Text style={h2}>{s.title}</Text>
              {s.rows.length === 0 ? <Text style={muted}>Veri yok</Text> : s.rows.map((r, i) => (
                <Text key={`${r.label}-${i}`} style={line}>{r.label}: <strong>{r.value}</strong></Text>
              ))}
            </Section>
          ))}
          <Text style={{ ...muted, marginTop: '24px' }}>Bu raporu mağaza panelinizde Analitik → Raporlar bölümünden kapatabilirsiniz.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', color: '#111111', margin: '4px 0' }
const h2 = { fontSize: '15px', color: '#111111', fontWeight: 700, margin: '0 0 4px' }
const line = { fontSize: '14px', color: '#333333', margin: '2px 0' }
const muted = { fontSize: '13px', color: '#777777', margin: '0' }

export const template: TemplateEntry = {
  component: AnalyticsReportEmail,
  subject: (d) => `${d['storeName'] ?? ''} · ${d['reportLabel'] ?? 'Analitik raporu'}`,
  displayName: 'Analitik raporu',
  previewData: { storeName: 'Örnek Mağaza', reportLabel: 'Günlük satış özeti', rangeLabel: '23.09.2026', rows: [{ label: 'Satış', value: '₺12.450' }], sections: [] },
}
