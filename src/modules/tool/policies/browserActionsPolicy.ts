import type { ToolPolicy } from '../toolPolicyTypes'

function getStepType(step: unknown): string | undefined {
  if (step === null || typeof step !== 'object') return undefined
  const type = (step as Record<string, unknown>).type
  return typeof type === 'string' ? type : undefined
}

function isShowOptionEnabled(args: Record<string, unknown>): boolean {
  const options = args.options
  if (options === null || typeof options !== 'object') return false
  return (options as Record<string, unknown>).show === true
}

function wantsVisibleBrowser(args: Record<string, unknown>): boolean {
  const steps = Array.isArray(args.steps) ? args.steps : []
  const hasShowStep = steps.some((step) => getStepType(step) === 'show')
  return hasShowStep || isShowOptionEnabled(args)
}

export const browserActionsPolicy: ToolPolicy = {
  name: 'browser_actions',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolve(_tool, args, _ctx) {
    return wantsVisibleBrowser(args) ? 'ask' : 'allow'
  }
}
