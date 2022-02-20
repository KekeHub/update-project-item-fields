import * as core from '@actions/core'
import {Updater, UpdaterConfig} from './updater'
import {inspect} from 'util'

function getFields(): Record<string, any> {
  const rawLabels = core.getInput('fields', {required: true})
  let lines: string[]
  if (rawLabels.includes('\n')) {
    lines = rawLabels.split('\n').filter(l => l !== '')
  } else {
    lines = rawLabels.split(',')
  }

  return lines.reduce<Record<string, any>>((obj, l) => {
    const [k, v] = l.split('=')
    obj[k] = v
    return obj
  }, {})
}

async function run(): Promise<void> {
  try {
    const config: UpdaterConfig = {
      app: {
        appId: core.getInput('app-integration-id') || '',
        installationId: core.getInput('app-installation-id') || '',
        privateKey: core.getInput('app-private-key') || ''
      },
      fields: getFields(),
      owner: core.getInput('owner', {required: true}),
      projectId: parseInt(core.getInput('project-id', {required: true}), 10),
      projectItemId: parseInt(
        core.getInput('project-item-id', {required: true}),
        10
      ),
      token: core.getInput('token', {required: true})
    }

    core.debug('Fields')
    core.debug(inspect(config.fields))

    const assigner = new Updater(config)
    await assigner.run()
  } catch (err: any) {
    core.setFailed(err.message)
    core.debug(err.stack)
  }
}

run()
