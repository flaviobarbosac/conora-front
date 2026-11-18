import { PageHeader } from '../components/PageHeader'
import { WhatsAppSection } from './settings/WhatsAppSection'
import styles from './pageStyles'

export function WhatsAppPage() {
  return (
    <div className={styles.page}>
      <PageHeader title="WhatsApp" backTo={{ to: '/configuracoes', label: '← Configurações' }} />
      <WhatsAppSection />
    </div>
  )
}
