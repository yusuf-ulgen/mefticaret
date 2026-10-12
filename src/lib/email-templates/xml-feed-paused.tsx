import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'

interface Props {
  feedName?: string
  reason?: string
  errorCount?: number
  panelUrl?: string
}

function XmlFeedPausedEmail({ feedName, reason, errorCount, panelUrl }: Props) {
  return (
    <Html lang="tr" dir="ltr">
      <Head />
      <Preview>{`${feedName ?? 'XML besleme'} otomatik durduruldu`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>XML beslemeniz durduruldu</Heading>
          <Text style={text}>
            <strong>{feedName || 'Besleme'}</strong> içe aktarımı hata eşiğini aştığı için otomatik olarak durduruldu.
          </Text>
          <Text style={text}>{reason}</Text>
          {errorCount ? <Text style={text}>Hatalı ürün sayısı: {errorCount}</Text> : null}
          <Text style={text}>
            Hatalı Ürünler listesini inceleyip sorunları giderdikten sonra beslemeyi yeniden açabilirsiniz.
          </Text>
          {panelUrl ? (
            <Button href={panelUrl} style={button}>
              Hatalı ürünleri aç
            </Button>
          ) : null}
          <Text style={muted}>Mefticaret XML Entegratör</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '520px' }
const h1 = { fontSize: '22px', color: '#111111', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.5' }
const button = { backgroundColor: '#7c3aed', color: '#ffffff', padding: '12px 20px', borderRadius: '999px', fontSize: '14px', textDecoration: 'none' }
const muted = { fontSize: '13px', color: '#777777', lineHeight: '1.5', marginTop: '24px' }

export const template: TemplateEntry = {
  component: XmlFeedPausedEmail,
  subject: (d) => `XML besleme durduruldu: ${d['feedName'] ?? 'Besleme'}`,
  displayName: 'XML besleme durduruldu',
  previewData: {
    feedName: 'Bacio Tedarikçi',
    reason: '100 hata eşiği aşıldı; besleme otomatik durduruldu',
    errorCount: 112,
    panelUrl: 'https://mefticaret.com',
  },
}
