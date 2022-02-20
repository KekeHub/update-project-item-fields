import * as core from '@actions/core'
import {createAppAuth} from '@octokit/auth-app'
import {graphql} from '@octokit/graphql'
import {inspect} from 'util'

export interface UpdaterConfig {
  app: {
    appId: string
    installationId: string
    privateKey: string
  }

  fields: Record<string, any>
  owner: string
  projectId: number
  projectItemId: string
  token: string
}

interface Field {
  id: string
  name: string
  settings?: Record<string, any>
  value: any | undefined
}

export class Updater {
  #github

  constructor(private config: UpdaterConfig) {
    if (
      config.app.appId &&
      config.app.installationId &&
      config.app.privateKey
    ) {
      core.info('Use GitHub App credentials for this integration')
      const auth = createAppAuth(config.app)

      this.#github = graphql.defaults({
        request: {
          hook: auth.hook
        }
      })
    } else {
      core.info('Use GitHub token for this integration')
      this.#github = graphql.defaults({
        headers: {
          authorization: `token ${config.token}`
        }
      })
    }
  }

  private async getProjectFields(projectId: string): Promise<Field[]> {
    const {node} = await this.#github(
      `query ($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectNext {
            fields(first: 20) {
              nodes {
                id
                name
                settings
              }
            }
          }
        }
      }`,
      {
        projectId
      }
    )

    return node.fields.nodes.map((n: any) => {
      const f = {
        id: n.id,
        name: n.name,
        settings: n.settings === 'null' ? undefined : JSON.parse(n.settings)
      } as Field

      f.value = this.config.fields[f.name]
      return f
    }) as Field[]
  }

  private async getProjectId(owner: string, num: number): Promise<string> {
    try {
      return await this.getOrganizationProjectId(owner, num)
    } catch (e) {
      core.debug("Couldn't find organization project, looking for user project")
      return await this.getUserProjectId(owner, num)
    }
  }

  private async getOrganizationProjectId(
    owner: string,
    num: number
  ): Promise<string> {
    const {organization} = await this.#github(
      `query ($owner: String!, $number: Int!) {
        organization(login: $owner){
          projectNext(number: $number) {
            id
          }
        }
    }`,
      {
        owner,
        number: num
      }
    )

    const id = organization.projectNext.id
    return id
  }

  private async getUserProjectId(login: string, num: number): Promise<string> {
    const {user} = await this.#github(
      `query ($owner: String!, $number: Int!) {
        user(login: $login){
          projectNext(number: $number) {
            id
          }
        }
    }`,
      {
        login,
        number: num
      }
    )

    const id = user.projectNext.id
    return id
  }

  private async updateProjectField(
    projectNodeId: string,
    field: Field
  ): Promise<void> {
    core.debug(
      `Update project field for ${inspect(
        field
      )}, projectId ${projectNodeId}, itemId: ${this.config.projectItemId}`
    )

    await this.#github(
      `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
        updateProjectNextItemField(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: $value
          }
        ) {
          projectNextItem {
            id
          }
        }
      }`,
      {
        projectId: projectNodeId,
        itemId: this.config.projectItemId,
        fieldId: field.id,
        value: field.value
      }
    )
  }

  private async updateProjectFields(
    projectNodeId: string,
    fields: Field[]
  ): Promise<void> {
    await Promise.all(
      fields.map(async f => this.updateProjectField(projectNodeId, f))
    )
  }

  async run(): Promise<void> {
    const projectNodeId = await this.getProjectId(
      this.config.owner,
      this.config.projectId
    )

    const fields = await this.getProjectFields(projectNodeId)
    await this.updateProjectFields(
      projectNodeId,
      fields.filter(f => f.value)
    )
  }
}
