
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "api_tokens": {
                  Row: {
                    "created_at": string,"id": string,"last_used_at": string | null,"last4": string,"name": string,"revoked_at": string | null,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"last4": string,"name": string,"revoked_at"?: string | null,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_used_at"?: string | null,"last4"?: string,"name"?: string,"revoked_at"?: string | null,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"calendar_events": {
                  Row: {
                    "all_day": boolean,"calendar_id": string,"end_at": string | null,"end_date": string | null,"event_id": string,"html_link": string | null,"start_at": string | null,"start_date": string | null,"synced_at": string,"title": string,"user_id": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day": boolean,"calendar_id": string,"end_at"?: string | null,"end_date"?: string | null,"event_id": string,"html_link"?: string | null,"start_at"?: string | null,"start_date"?: string | null,"synced_at": string,"title"?: string,"user_id": string,"video_url"?: string | null
                  }
                  Update: {
                    "all_day"?: boolean,"calendar_id"?: string,"end_at"?: string | null,"end_date"?: string | null,"event_id"?: string,"html_link"?: string | null,"start_at"?: string | null,"start_date"?: string | null,"synced_at"?: string,"title"?: string,"user_id"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"google_connections": {
                  Row: {
                    "created_at": string,"refresh_token_encrypted": string,"scopes": (string)[],"status": Database["public"]['Enums']["connection_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"refresh_token_encrypted": string,"scopes"?: (string)[],"status"?: Database["public"]['Enums']["connection_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"refresh_token_encrypted"?: string,"scopes"?: (string)[],"status"?: Database["public"]['Enums']["connection_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ideas": {
                  Row: {
                    "created_at": string,"done_at": string | null,"external_id": string | null,"id": string,"last_shown_at": string | null,"snoozed_until": string | null,"source": Database["public"]['Enums']["idea_source"],"text": string,"text_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"external_id"?: string | null,"id"?: string,"last_shown_at"?: string | null,"snoozed_until"?: string | null,"source": Database["public"]['Enums']["idea_source"],"text": string,"text_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"external_id"?: string | null,"id"?: string,"last_shown_at"?: string | null,"snoozed_until"?: string | null,"source"?: Database["public"]['Enums']["idea_source"],"text"?: string,"text_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"locale": Database["public"]['Enums']["app_locale"] | null,"scene": Database["public"]['Enums']["scene_preference"],"theme": Database["public"]['Enums']["theme_preference"],"timezone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"locale"?: Database["public"]['Enums']["app_locale"] | null,"scene"?: Database["public"]['Enums']["scene_preference"],"theme"?: Database["public"]['Enums']["theme_preference"],"timezone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"locale"?: Database["public"]['Enums']["app_locale"] | null,"scene"?: Database["public"]['Enums']["scene_preference"],"theme"?: Database["public"]['Enums']["theme_preference"],"timezone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sync_state": {
                  Row: {
                    "error": string | null,"locked_until": string | null,"source": Database["public"]['Enums']["sync_source"],"synced_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"locked_until"?: string | null,"source": Database["public"]['Enums']["sync_source"],"synced_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "error"?: string | null,"locked_until"?: string | null,"source"?: Database["public"]['Enums']["sync_source"],"synced_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_idea":
{ Args: { "p_external_id"?: string,"p_source": Database["public"]['Enums']["idea_source"],"p_text": string,"p_text_hash": string,"p_user_id": string }; Returns: {
              "created": boolean,"created_at": string,"done_at": string,"external_id": string,"id": string,"last_shown_at": string,"snoozed_until": string,"source": Database["public"]['Enums']["idea_source"],"text": string
            }[]
                           },
"create_api_token":
{ Args: { "p_last4": string,"p_limit": number,"p_name": string,"p_token_hash": string,"p_user_id": string }; Returns: {
              "created_at": string,
"id": string,
"last_used_at": string | null,
"last4": string,
"name": string,
"revoked_at": string | null,
"token_hash": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "api_tokens"
        isOneToOne: false
        isSetofReturn: true
      } },
"fail_calendar_sync":
{ Args: { "p_error": string,"p_status": Database["public"]['Enums']["connection_status"],"p_user_id": string }; Returns: undefined
                           },
"save_calendar_sync":
{ Args: { "p_events": Json,"p_synced_at": string,"p_user_id": string }; Returns: undefined
                           },
"try_lock_sync":
{ Args: { "p_seconds": number,"p_source": Database["public"]['Enums']["sync_source"],"p_user_id": string }; Returns: boolean
                           },
"use_api_token":
{ Args: { "p_token_hash": string }; Returns: {
              "token_hash": string,"user_id": string
            }[]
                           }
          }
          Enums: {
            "app_locale": "en"|"ru","connection_status": "active"|"revoked"|"error","idea_source": "command"|"shortcut"|"reminders","scene_preference": "auto"|"morning"|"day"|"evening"|"night","sync_source": "calendar","theme_preference": "auto"|"light"|"dark"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_locale": ["en", "ru"],"connection_status": ["active", "revoked", "error"],"idea_source": ["command", "shortcut", "reminders"],"scene_preference": ["auto", "morning", "day", "evening", "night"],"sync_source": ["calendar"],"theme_preference": ["auto", "light", "dark"]
          }
        }
} as const
