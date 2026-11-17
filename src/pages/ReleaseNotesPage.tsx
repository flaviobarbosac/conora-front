import { PageHeader } from '../components/PageHeader'
import { latestRelease, RELEASE_NOTES } from '../lib/releaseNotes'
import styles from './pageStyles'

export function ReleaseNotesPage() {
  const current = latestRelease()

  return (
    <div className={styles.page}>
      <PageHeader title="Novidades" kicker={current.version === __APP_VERSION__ ? 'Esta é a versão que você está usando' : undefined} />
      <ul className={styles.list}>
        {RELEASE_NOTES.map((release) => (
          <li key={release.version} className={styles.releaseRow}>
            <div className={styles.releaseHead}>
              <h2 className={styles.sectionTitle}>{release.version}</h2>
              <span className={styles.muted}>{release.date}</span>
            </div>
            <ul className={styles.releaseItems}>
              {release.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
