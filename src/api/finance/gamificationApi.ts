import { apiFetch, getAccessToken, userIdFromAccessToken } from '../client'
import { logNewMilestones } from '../../lib/metaEvents'
import { query } from './helpers'
import type {
  Journey,
  Achievement,
  Achievements,
  ReserveThermometer,
  HomeProgress,
  MonthCloseSummary,
  YearRetrospective,
} from './types'

/** Logs newly conquered journey milestones to Meta (native only, never blocks the response). */
function trackMilestones<T>(items: (data: T) => Achievement[]) {
  return (data: T): T => {
    try {
      logNewMilestones(userIdFromAccessToken(getAccessToken()), items(data))
    } catch {
      // measurement must not break the screen
    }
    return data
  }
}

export const gamificationApi = {
  journey: () => apiFetch<Journey>('/gamification/journey'),
  achievements: () =>
    apiFetch<Achievements>('/gamification/achievements').then(trackMilestones((d: Achievements) => d.items)),
  home: (competenceYm?: string) =>
    apiFetch<HomeProgress>(`/gamification/home${query({ competenceYm })}`).then(
      trackMilestones((d: HomeProgress) => d.achievements ?? []),
    ),
  reserve: (competenceYm?: string) =>
    apiFetch<ReserveThermometer>(`/gamification/reserve${query({ competenceYm })}`),
  monthSummary: (ym: string) => apiFetch<MonthCloseSummary>(`/gamification/months/${ym}/summary`),
  retrospective: (year: number) => apiFetch<YearRetrospective>(`/gamification/retrospective/${year}`),
}
