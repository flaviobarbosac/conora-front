import { apiFetch } from '../client'
import { query } from './helpers'
import type {
  Journey,
  Achievements,
  ReserveThermometer,
  HomeProgress,
  MonthCloseSummary,
  YearRetrospective,
} from './types'
export const gamificationApi = {
  journey: () => apiFetch<Journey>('/gamification/journey'),
  achievements: () => apiFetch<Achievements>('/gamification/achievements'),
  home: (competenceYm?: string) =>
    apiFetch<HomeProgress>(`/gamification/home${query({ competenceYm })}`),
  reserve: (competenceYm?: string) =>
    apiFetch<ReserveThermometer>(`/gamification/reserve${query({ competenceYm })}`),
  monthSummary: (ym: string) => apiFetch<MonthCloseSummary>(`/gamification/months/${ym}/summary`),
  retrospective: (year: number) => apiFetch<YearRetrospective>(`/gamification/retrospective/${year}`),
}
