import type { Category, CategorySection, Entry } from '../../api/finance'
import { MoneyAbbrevLegend } from '../../components/MoneyAbbrevLegend'
import { ProgressToneLegend } from '../../components/ProgressToneLegend'
import { categoryLabel } from '../../lib/categoryLabel'
import { compareCategorySiblings } from '../../lib/categoryOrder'
import pageStyles from '../pageStyles'
import raioStyles from './raioX.module.css'
import {
  MONTHS_MAX,
  MONTHS_MIN,
  MONTH_MARKS,
  RAIOX_ANCHORS,
  RaioXAccountBlock,
  scrollToRaioXAnchor,
} from './raioXShared'

const styles = { ...pageStyles, ...raioStyles }

export function buildTreeMenuItems(
  heads: Array<Category | undefined>,
  byParent: Map<string | null, Category[]>,
): Category[] {
  const items: Category[] = []
  for (const head of heads) {
    if (!head) continue
    items.push(...(byParent.get(head.id) ?? []))
  }
  return items.sort(compareCategorySiblings)
}

export function RaioXAnchorsNav({
  treeMenuOpen,
  treeMenuItems,
  setTreeMenuOpen,
  onJump,
}: {
  treeMenuOpen: boolean
  treeMenuItems: Category[]
  setTreeMenuOpen: (value: boolean | ((open: boolean) => boolean)) => void
  onJump: (accountId: string) => void
}) {
  return (
    <nav
      className={styles.raioxAnchors}
      aria-label="Seções do Raio-X"
      onClick={(event) => event.stopPropagation()}
    >
      <div className={styles.raioxAnchorsScroll}>
        {RAIOX_ANCHORS.map((anchor) => (
          <button
            key={anchor.id}
            type="button"
            className={styles.raioxAnchor}
            onClick={() => {
              setTreeMenuOpen(false)
              scrollToRaioXAnchor(anchor.id)
            }}
          >
            {anchor.label}
          </button>
        ))}
      </div>
      <div className={styles.raioxAnchorMenu}>
        <button
          type="button"
          className={styles.raioxAnchor}
          aria-expanded={treeMenuOpen}
          aria-haspopup="menu"
          aria-controls="raiox-tree-menu"
          onClick={() => setTreeMenuOpen((openMenu) => !openMenu)}
        >
          Categorias
        </button>
        {treeMenuOpen ? (
          <div id="raiox-tree-menu" className={styles.raioxAnchorDropdown} role="menu">
            {treeMenuItems.length === 0 ? (
              <p className={styles.raioxAnchorEmpty}>Nenhuma seção na árvore.</p>
            ) : (
              treeMenuItems.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  role="menuitem"
                  className={styles.raioxAnchorOption}
                  onClick={() => onJump(account.id)}
                >
                  {categoryLabel(account)}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </nav>
  )
}

export function RaioXPeriodLeakageControls({
  months,
  leakageOnly,
  setMonths,
  setLeakageOnly,
}: {
  months: number
  leakageOnly: boolean
  setMonths: (value: number | ((current: number) => number)) => void
  setLeakageOnly: (value: boolean) => void
}) {
  return (
    <div className={styles.raioxControls} onClick={(event) => event.stopPropagation()}>
      <div className={styles.periodSlider}>
        <span className={styles.periodSliderValue} id="raiox-period-label">
          {months === 1 ? 'Período: este mês' : `Período: ${months} meses`}
        </span>
        <div className={styles.periodSliderControls}>
          <button
            type="button"
            className={styles.periodSliderStep}
            aria-label="Diminuir meses"
            disabled={months <= MONTHS_MIN}
            onClick={() => setMonths((current) => Math.max(MONTHS_MIN, current - 1))}
          >
            −
          </button>
          <div className={styles.periodSliderTrack}>
            <input
              type="range"
              min={MONTHS_MIN}
              max={MONTHS_MAX}
              step={1}
              value={months}
              list="raiox-month-marks"
              aria-labelledby="raiox-period-label"
              aria-valuemin={MONTHS_MIN}
              aria-valuemax={MONTHS_MAX}
              aria-valuenow={months}
              aria-valuetext={months === 1 ? 'Período: este mês' : `Período: ${months} meses`}
              onChange={(event) => setMonths(Number(event.target.value))}
            />
            <datalist id="raiox-month-marks">
              {MONTH_MARKS.map((mark) => (
                <option key={mark} value={mark} label={String(mark)} />
              ))}
            </datalist>
            <div className={styles.periodSliderMarks} aria-hidden>
              {MONTH_MARKS.map((mark) => (
                <button
                  key={mark}
                  type="button"
                  className={
                    months === mark
                      ? `${styles.periodSliderMark} ${styles.periodSliderMarkActive}`
                      : styles.periodSliderMark
                  }
                  style={{
                    left: `${((mark - MONTHS_MIN) / (MONTHS_MAX - MONTHS_MIN)) * 100}%`,
                  }}
                  tabIndex={-1}
                  onClick={() => setMonths(mark)}
                >
                  {mark}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.periodSliderStep}
            aria-label="Aumentar meses"
            disabled={months >= MONTHS_MAX}
            onClick={() => setMonths((current) => Math.min(MONTHS_MAX, current + 1))}
          >
            +
          </button>
        </div>
      </div>
      <label className={styles.leakageFilter}>
        <span className={styles.leakageCheck}>
          <input
            type="checkbox"
            checked={leakageOnly}
            onChange={(event) => setLeakageOnly(event.target.checked)}
          />
        </span>
        <span className={styles.leakageText}>
          <span className={styles.leakageTitle}>Só vazamento (≥ 100%)</span>
          <span className={styles.leakageHint}>Filtra a árvore de categorias</span>
        </span>
      </label>
    </div>
  )
}

export function RaioXTreeList({
  rootRows,
  byParent,
  planned,
  actual,
  open,
  highlighted,
  entriesByAccount,
  categoryNameById,
  bankNameById,
  leakageOnly,
  freeLimited,
  categoryUnlocked,
  onToggle,
  onSelect,
  onOpenEntry,
  onOpenActual,
  onUnbudgetedClick,
}: {
  rootRows: Category[]
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  highlighted: CategorySection[]
  entriesByAccount: Map<string, Entry[]>
  categoryNameById: Map<string, string>
  bankNameById: Map<string, string>
  leakageOnly: boolean
  freeLimited: boolean
  categoryUnlocked: (account: Category) => boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onOpenEntry: (entry: Entry) => void
  onOpenActual: (account: Category, launchEntries: Entry[]) => void
  onUnbudgetedClick: (accountId: string) => void
}) {
  return (
    <div id="raiox-arvore" className={styles.raioxList}>
      <div className={styles.raioxTreeHead}>
        <strong>Categorias</strong>
        <div className={styles.raioxTreeHeadHints}>
          <ProgressToneLegend />
          <MoneyAbbrevLegend />
        </div>
      </div>
      <div className={`${styles.raioxRow} ${styles.raioxHead}`} aria-hidden={false}>
        <span />
        <span>Categoria</span>
        <span className={styles.raioxTotals}>
          <span title="Previsto">Previsto</span>
          <span title="Realizado">Realizado</span>
          <span title="Percentual">%</span>
        </span>
      </div>
      {rootRows.map((account) => (
        <RaioXAccountBlock
          key={account.id}
          account={account}
          depth={0}
          byParent={byParent}
          planned={planned}
          actual={actual}
          open={open}
          highlighted={highlighted}
          entriesByAccount={entriesByAccount}
          categoryNameById={categoryNameById}
          bankNameById={bankNameById}
          leakageOnly={leakageOnly}
          freeLimited={freeLimited}
          categoryUnlocked={categoryUnlocked}
          onToggle={onToggle}
          onSelect={onSelect}
          onOpenEntry={onOpenEntry}
          onOpenActual={onOpenActual}
          onUnbudgetedClick={onUnbudgetedClick}
        />
      ))}
    </div>
  )
}

export function RaioXNoLeakageCelebrate() {
  return (
    <section
      id="raiox-arvore"
      className={styles.celebrateInline}
      aria-label="Sem vazamento de orçamento"
    >
      <img
        className={styles.celebrateSymbol}
        src={`${import.meta.env.BASE_URL}brand/simbolo.png`}
        alt=""
        width={72}
        height={72}
      />
      <h2 className={styles.celebrateTitle}>Parabéns</h2>
      <p className={styles.celebrateMessage}>
        Nenhuma categoria chegou a 100% do orçamento. Seu mês está no eixo.
      </p>
    </section>
  )
}
