export type Settings = SingleSelect

export interface SingleSelect {
  options: SingleSelectOption[]
}

export interface SingleSelectOption {
  id: string
  name: string
  name_html: string
}
