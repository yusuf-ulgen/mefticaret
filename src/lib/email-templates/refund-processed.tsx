import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

import type { TemplateEntry } from './registry'

interface RefundEmailProps {
  storeName?: string
  customerName?: string
  orderNumber?: string
  refundNumber?: string
  amount?: string
  method?: string
}

function RefundProcessedEmail({ storeName, customerName, orderNumber, refundNumber, amount, method }: RefundEmailProps) {
  return (
    <Html lang="tr" dir="ltr">
      <Head />
      <Preview>{`${orderNumber ?? ''} siparişiniz için iadeniz tamamlandı`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>İadeniz tamamlandı</Heading>
          <Text style={text}>Merhaba {customerName || 'değerli müşterimiz'},</Text>
          <Text style={text}>
            {storeName} mağazasındaki #{orderNumber} numaralı siparişiniz için {refundNumber} numaralı iadeniz işlendi.
          </Text>
          <Text style={strong}>İade tutarı: {amount}</Text>
          <Text style={text}>İade yöntemi: {method}</Text>
          <Text style={muted}>
            Kartınıza yapılan iadelerin hesabınıza yansıması bankanıza bağlı olarak birkaç iş günü sürebilir.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '520px' }
const h1 = { fontSize: '22px', color: '#111111', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.5' }
const strong = { ...text, fontWeight: 700 }
const muted = { fontSize: '13px', color: '#777777', lineHeight: '1.5' }

export const template: TemplateEntry = {
  component: RefundProcessedEmail,
  subject: (d) => `#${d['orderNumber'] ?? ''} siparişiniz için iadeniz tamamlandı`,
  displayName: 'İade tamamlandı',
  previewData: {
    storeName: 'Örnek Mağaza',
    customerName: 'Ayşe',
    orderNumber: '1001',
    refundNumber: 'REF-0001',
    amount: '₺225,00',
    method: 'Orijinal ödeme yöntemi',
  },
}
