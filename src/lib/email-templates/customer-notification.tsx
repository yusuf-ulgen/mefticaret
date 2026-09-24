import * as React from 'react'
import { Body, Button, Container, Head, Hr, Html, Img, Link, Preview, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'

interface Props {
  subject?: string
  body?: string
  storeName?: string
  logoUrl?: string
  brandColor?: string
  actionUrl?: string
  actionLabel?: string
  unsubscribeUrl?: string
}

/** Mağazanın düzenlediği metinle gönderilen genel müşteri bildirimi. */
function CustomerNotificationEmail({ subject, body, storeName, logoUrl, brandColor, actionUrl, actionLabel, unsubscribeUrl }: Props) {
  const color = /^#[0-9a-f]{6}$/i.test(brandColor ?? '') ? brandColor! : '#111111'
  const paragraphs = (body ?? '').split(/\n{2,}/)
  return (
    <Html lang="tr" dir="ltr">
      <Head />
      <Preview>{subject ?? ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl ? <Img src={logoUrl} alt={storeName ?? ''} height="40" style={{ marginBottom: 16 }} /> : (
            <Text style={{ ...brand, color }}>{storeName}</Text>
          )}
          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>
              {p.split('\n').map((line, j) => (
                <React.Fragment key={j}>{j > 0 ? <br /> : null}{line}</React.Fragment>
              ))}
            </Text>
          ))}
          {actionUrl ? (
            <Button href={actionUrl} style={{ ...button, backgroundColor: color }}>{actionLabel ?? 'Görüntüle'}</Button>
          ) : null}
          <Hr style={{ borderColor: '#eeeeee', margin: '24px 0 12px' }} />
          <Text style={muted}>
            Bu e-postayı {storeName} mağazasından sipariş verdiğiniz için aldınız.{' '}
            {unsubscribeUrl ? <Link href={unsubscribeUrl} style={{ color: '#777777' }}>Bildirimlerden çık</Link> : null}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '520px' }
const brand = { fontSize: '20px', fontWeight: 700, margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.5' }
const button = { color: '#ffffff', padding: '12px 20px', borderRadius: '999px', fontSize: '15px', textDecoration: 'none' }
const muted = { fontSize: '12px', color: '#777777', lineHeight: '1.5' }

export const template: TemplateEntry = {
  component: CustomerNotificationEmail,
  subject: (d) => String(d['subject'] ?? 'Siparişiniz hakkında'),
  displayName: 'Müşteri bildirimi',
  previewData: {
    subject: 'Siparişiniz kargoya verildi #1234',
    body: 'Merhaba Ayşe,\n\nSiparişiniz kargoya verildi!\nKargo: Yurtiçi Kargo | Takip: YK123456789',
    storeName: 'Örnek Mağaza',
    actionUrl: 'https://mefticaret.com/kargo-takip/YK123456789',
    actionLabel: 'Kargoyu takip et',
    unsubscribeUrl: 'https://mefticaret.com/bildirim-iptal?t=ornek',
  },
}
