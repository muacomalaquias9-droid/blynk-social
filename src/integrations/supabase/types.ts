export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_history: {
        Row: {
          action_type: string
          city: string | null
          country: string | null
          created_at: string | null
          device_id: string | null
          id: string
          ip_address: string | null
          risk_level: string | null
          success: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          ip_address?: string | null
          risk_level?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          ip_address?: string | null
          risk_level?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_comments: {
        Row: {
          ad_id: string
          content: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          ad_id: string
          content: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_comments_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_likes: {
        Row: {
          ad_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_likes_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "sponsored_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_payment_logs: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_reference: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_reference?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_reference?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_payment_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "verification_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_origins: string[] | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          public_key: string
          rate_limit_per_minute: number
          scopes: string[]
          secret_key_hash: string
          secret_key_preview: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_origins?: string[] | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          public_key: string
          rate_limit_per_minute?: number
          scopes?: string[]
          secret_key_hash: string
          secret_key_preview: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_origins?: string[] | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          public_key?: string
          rate_limit_per_minute?: number
          scopes?: string[]
          secret_key_hash?: string
          secret_key_preview?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          origin: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          origin?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          origin?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_accounts: {
        Row: {
          blocked_by: string | null
          created_at: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_accounts_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          caller_id: string
          ended_at: string | null
          id: string
          receiver_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          call_type: string
          caller_id: string
          ended_at?: string | null
          id?: string
          receiver_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          call_type?: string
          caller_id?: string
          ended_at?: string | null
          id?: string
          receiver_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_admins: {
        Row: {
          added_at: string | null
          channel_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          channel_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          channel_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_admins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_followers: {
        Row: {
          channel_id: string
          followed_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          followed_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          followed_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_followers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_invites: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          invited_user_id: string
          inviter_id: string
          status: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          invited_user_id: string
          inviter_id: string
          status?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          invited_user_id?: string
          inviter_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_invites_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          duration: number | null
          id: string
          media_url: string | null
          message_type: string | null
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          duration?: number | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          duration?: number | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          follower_count: number | null
          id: string
          is_public: boolean | null
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          follower_count?: number | null
          id?: string
          is_public?: boolean | null
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          follower_count?: number | null
          id?: string
          is_public?: boolean | null
          name?: string
        }
        Relationships: []
      }
      chat_settings: {
        Row: {
          chat_partner_id: string
          created_at: string | null
          id: string
          is_locked: boolean | null
          media_visibility: boolean | null
          pin_code: string | null
          temporary_messages_duration: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_partner_id: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          media_visibility?: boolean | null
          pin_code?: string | null
          temporary_messages_duration?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_partner_id?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          media_visibility?: boolean | null
          pin_code?: string | null
          temporary_messages_duration?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_wallpapers: {
        Row: {
          chat_partner_id: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          wallpaper_url: string
        }
        Insert: {
          chat_partner_id: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          wallpaper_url: string
        }
        Update: {
          chat_partner_id?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          wallpaper_url?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ctf_challenges: {
        Row: {
          category: string
          challenge_url: string | null
          created_at: string
          description: string
          difficulty: string
          file_url: string | null
          flag: string
          hint: string | null
          id: string
          is_active: boolean | null
          order_index: number
          points: number
          reward_points: number | null
          solution_explanation: string | null
          title: string
        }
        Insert: {
          category: string
          challenge_url?: string | null
          created_at?: string
          description: string
          difficulty?: string
          file_url?: string | null
          flag: string
          hint?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number
          points?: number
          reward_points?: number | null
          solution_explanation?: string | null
          title: string
        }
        Update: {
          category?: string
          challenge_url?: string | null
          created_at?: string
          description?: string
          difficulty?: string
          file_url?: string | null
          flag?: string
          hint?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number
          points?: number
          reward_points?: number | null
          solution_explanation?: string | null
          title?: string
        }
        Relationships: []
      }
      ctf_participants: {
        Row: {
          affiliate_code: string | null
          challenges_completed: number | null
          current_rank: number | null
          enrolled_at: string
          id: string
          referred_by: string | null
          total_points: number | null
          user_id: string
        }
        Insert: {
          affiliate_code?: string | null
          challenges_completed?: number | null
          current_rank?: number | null
          enrolled_at?: string
          id?: string
          referred_by?: string | null
          total_points?: number | null
          user_id: string
        }
        Update: {
          affiliate_code?: string | null
          challenges_completed?: number | null
          current_rank?: number | null
          enrolled_at?: string
          id?: string
          referred_by?: string | null
          total_points?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctf_participants_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "ctf_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      ctf_rewards: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          points_required: number
          reward_type: string
          reward_value: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          points_required: number
          reward_type?: string
          reward_value?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          points_required?: number
          reward_type?: string
          reward_value?: Json | null
        }
        Relationships: []
      }
      ctf_submissions: {
        Row: {
          attempts: number | null
          challenge_id: string
          created_at: string
          id: string
          is_correct: boolean
          solved_at: string | null
          submitted_flag: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          challenge_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          solved_at?: string | null
          submitted_flag: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          challenge_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          solved_at?: string | null
          submitted_flag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctf_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "ctf_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      ctf_team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctf_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "ctf_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ctf_teams: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          id: string
          invite_code: string | null
          is_public: boolean | null
          leader_id: string
          name: string
          total_points: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean | null
          leader_id: string
          name: string
          total_points?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          invite_code?: string | null
          is_public?: boolean | null
          leader_id?: string
          name?: string
          total_points?: number | null
        }
        Relationships: []
      }
      ctf_user_rewards: {
        Row: {
          claimed_at: string | null
          id: string
          reward_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          reward_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          reward_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctf_user_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "ctf_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string | null
          id: string
          user_id_1: string
          user_id_2: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id_1: string
          user_id_2: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id_1?: string
          user_id_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_id_1_fkey"
            columns: ["user_id_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_2_fkey"
            columns: ["user_id_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_admin: boolean | null
          is_muted: boolean | null
          joined_at: string | null
          nickname: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_admin?: boolean | null
          is_muted?: boolean | null
          joined_at?: string | null
          nickname?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_admin?: boolean | null
          is_muted?: boolean | null
          joined_at?: string | null
          nickname?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          duration: number | null
          group_id: string
          id: string
          image_url: string | null
          media_url: string | null
          message_type: string | null
          read_by: string[] | null
          sender_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          duration?: number | null
          group_id: string
          id?: string
          image_url?: string | null
          media_url?: string | null
          message_type?: string | null
          read_by?: string[] | null
          sender_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          duration?: number | null
          group_id?: string
          id?: string
          image_url?: string | null
          media_url?: string | null
          message_type?: string | null
          read_by?: string[] | null
          sender_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          all_members_can_edit_info: boolean | null
          all_members_can_send: boolean | null
          avatar_url: string | null
          created_at: string | null
          created_by: string
          id: string
          name: string
        }
        Insert: {
          all_members_can_edit_info?: boolean | null
          all_members_can_send?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          name: string
        }
        Update: {
          all_members_can_edit_info?: boolean | null
          all_members_can_send?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtag_followers: {
        Row: {
          followed_at: string | null
          hashtag_id: string
          id: string
          user_id: string
        }
        Insert: {
          followed_at?: string | null
          hashtag_id: string
          id?: string
          user_id: string
        }
        Update: {
          followed_at?: string | null
          hashtag_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hashtag_followers_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          post_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          post_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          post_count?: number | null
        }
        Relationships: []
      }
      live_streams: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          title: string
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_views: {
        Row: {
          id: string
          message_id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          duration: number | null
          id: string
          media_url: string | null
          message_type: string | null
          read: boolean | null
          receiver_id: string
          sender_id: string
          view_once: boolean | null
        }
        Insert: {
          content: string
          created_at?: string | null
          duration?: number | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          read?: boolean | null
          receiver_id: string
          sender_id: string
          view_once?: boolean | null
        }
        Update: {
          content?: string
          created_at?: string | null
          duration?: number | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
          view_once?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      page_profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          is_authenticated: boolean | null
          name: string
          page_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_authenticated?: boolean | null
          name: string
          page_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_authenticated?: boolean | null
          name?: string
          page_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      phone_verification_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone_number: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone_number: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone_number?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string
          id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          hashtag_id: string
          id?: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string | null
          id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_notifications: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_preferences: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          preference_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          preference_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          preference_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_preferences_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          media_urls: string[] | null
          music_artist: string | null
          music_name: string | null
          music_url: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_urls?: string[] | null
          music_artist?: string | null
          music_name?: string | null
          music_url?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          media_urls?: string[] | null
          music_artist?: string | null
          music_name?: string | null
          music_url?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badge_type: string | null
          banner_url: string | null
          bio: string | null
          category: string | null
          civil_status: string | null
          created_at: string | null
          email: string | null
          first_name: string
          full_name: string | null
          id: string
          instagram: string | null
          is_public: boolean | null
          location: string | null
          phone: string | null
          twitter: string | null
          updated_at: string | null
          username: string
          username_last_changed: string | null
          verified: boolean | null
          website: string | null
          youtube: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_type?: string | null
          banner_url?: string | null
          bio?: string | null
          category?: string | null
          civil_status?: string | null
          created_at?: string | null
          email?: string | null
          first_name: string
          full_name?: string | null
          id: string
          instagram?: string | null
          is_public?: boolean | null
          location?: string | null
          phone?: string | null
          twitter?: string | null
          updated_at?: string | null
          username: string
          username_last_changed?: string | null
          verified?: boolean | null
          website?: string | null
          youtube?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_type?: string | null
          banner_url?: string | null
          bio?: string | null
          category?: string | null
          civil_status?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          full_name?: string | null
          id?: string
          instagram?: string | null
          is_public?: boolean | null
          location?: string | null
          phone?: string | null
          twitter?: string | null
          updated_at?: string | null
          username?: string
          username_last_changed?: string | null
          verified?: boolean | null
          website?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          content_type: string
          created_at: string | null
          id: string
          reason: string
          reported_content_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          id?: string
          reason: string
          reported_content_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          id?: string
          reason?: string
          reported_content_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          action_taken: string | null
          alert_type: string
          created_at: string | null
          device_id: string | null
          id: string
          is_read: boolean | null
          message: string
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          alert_type: string
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          user_id: string
        }
        Update: {
          action_taken?: string | null
          alert_type?: string
          created_at?: string | null
          device_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      security_settings: {
        Row: {
          account_at_risk: boolean | null
          created_at: string | null
          id: string
          kick_old_sessions: boolean | null
          max_devices: number | null
          require_confirmation_ads: boolean | null
          require_confirmation_email: boolean | null
          require_confirmation_password: boolean | null
          trusted_devices_only: boolean | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_at_risk?: boolean | null
          created_at?: string | null
          id?: string
          kick_old_sessions?: boolean | null
          max_devices?: number | null
          require_confirmation_ads?: boolean | null
          require_confirmation_email?: boolean | null
          require_confirmation_password?: boolean | null
          trusted_devices_only?: boolean | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_at_risk?: boolean | null
          created_at?: string | null
          id?: string
          kick_old_sessions?: boolean | null
          max_devices?: number | null
          require_confirmation_ads?: boolean | null
          require_confirmation_email?: boolean | null
          require_confirmation_password?: boolean | null
          trusted_devices_only?: boolean | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sensitive_actions: {
        Row: {
          action_data: Json | null
          action_type: string
          confirmation_code: string | null
          confirmed: boolean | null
          created_at: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          action_type: string
          confirmation_code?: string | null
          confirmed?: boolean | null
          created_at?: string | null
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          confirmation_code?: string | null
          confirmed?: boolean | null
          created_at?: string | null
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sponsored_ads: {
        Row: {
          company_logo: string
          company_name: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          link_description: string | null
          link_image: string | null
          link_title: string | null
          link_url: string
        }
        Insert: {
          company_logo: string
          company_name: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          link_description?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url: string
        }
        Update: {
          company_logo?: string
          company_name?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          link_description?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string | null
          custom_music_url: string | null
          expires_at: string | null
          id: string
          media_type: string
          media_url: string
          music_artist: string | null
          music_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_music_url?: string | null
          expires_at?: string | null
          id?: string
          media_type: string
          media_url: string
          music_artist?: string | null
          music_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_music_url?: string | null
          expires_at?: string | null
          id?: string
          media_type?: string
          media_url?: string
          music_artist?: string | null
          music_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string | null
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_viewers: {
        Row: {
          id: string
          joined_at: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stream_viewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_music: {
        Row: {
          artist: string
          audio_url: string
          cover_url: string | null
          created_at: string | null
          duration: number
          id: string
          is_trending: boolean | null
          name: string
          play_count: number | null
        }
        Insert: {
          artist: string
          audio_url: string
          cover_url?: string | null
          created_at?: string | null
          duration: number
          id?: string
          is_trending?: boolean | null
          name: string
          play_count?: number | null
        }
        Update: {
          artist?: string
          audio_url?: string
          cover_url?: string | null
          created_at?: string | null
          duration?: number
          id?: string
          is_trending?: boolean | null
          name?: string
          play_count?: number | null
        }
        Relationships: []
      }
      two_factor_auth: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          secret: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          secret?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          secret?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      two_factor_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_action_limits: {
        Row: {
          action_count: number | null
          action_type: string
          created_at: string | null
          id: string
          is_suspended: boolean | null
          last_action_at: string | null
          reset_at: string | null
          suspended_until: string | null
          user_id: string
        }
        Insert: {
          action_count?: number | null
          action_type: string
          created_at?: string | null
          id?: string
          is_suspended?: boolean | null
          last_action_at?: string | null
          reset_at?: string | null
          suspended_until?: string | null
          user_id: string
        }
        Update: {
          action_count?: number | null
          action_type?: string
          created_at?: string | null
          id?: string
          is_suspended?: boolean | null
          last_action_at?: string | null
          reset_at?: string | null
          suspended_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          is_trusted: boolean | null
          last_active: string | null
          latitude: number | null
          longitude: number | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          is_trusted?: boolean | null
          last_active?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          is_trusted?: boolean | null
          last_active?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_earnings: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          source_type: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          source_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          is_online: boolean | null
          last_seen: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          is_online?: boolean | null
          last_seen?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          is_online?: boolean | null
          last_seen?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_id: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          id: string
          language: string | null
          media_quality: string | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          language?: string | null
          media_quality?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string | null
          media_quality?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_suspensions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          suspended_at: string
          suspended_by: string | null
          suspension_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          suspended_at?: string
          suspended_by?: string | null
          suspension_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          suspended_at?: string
          suspended_by?: string | null
          suspension_type?: string
          user_id?: string
        }
        Relationships: []
      }
      username_attempts: {
        Row: {
          attempt_count: number | null
          attempted_username: string
          created_at: string | null
          id: string
          is_blocked: boolean | null
          last_attempt_at: string | null
          user_id: string
        }
        Insert: {
          attempt_count?: number | null
          attempted_username: string
          created_at?: string | null
          id?: string
          is_blocked?: boolean | null
          last_attempt_at?: string | null
          user_id: string
        }
        Update: {
          attempt_count?: number | null
          attempted_username?: string
          created_at?: string | null
          id?: string
          is_blocked?: boolean | null
          last_attempt_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_subscriptions: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          paid_at: string | null
          payment_reference: string | null
          plan_type: string
          status: string
          transaction_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          plan_type?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          plan_type?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_video_comments: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_video_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "verification_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_video_likes: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_video_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "verification_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_videos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          share_code: string
          user_id: string
          video_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          share_code?: string
          user_id: string
          video_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          share_code?: string
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          id: string
          user_id: string
          video_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "verification_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          account_name: string | null
          amount: number
          bank_name: string | null
          created_at: string | null
          error_message: string | null
          iban: string | null
          id: string
          payout_reference: string | null
          payout_status: string | null
          phone: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          amount: number
          bank_name?: string | null
          created_at?: string | null
          error_message?: string | null
          iban?: string | null
          id?: string
          payout_reference?: string | null
          payout_status?: string | null
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          error_message?: string | null
          iban?: string | null
          id?: string
          payout_reference?: string | null
          payout_status?: string | null
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_action_limit: {
        Args: { _action_type: string; _limit: number; _user_id: string }
        Returns: Json
      }
      delete_expired_phone_codes: { Args: never; Returns: undefined }
      delete_expired_posts: { Args: never; Returns: undefined }
      delete_expired_stories: { Args: never; Returns: undefined }
      delete_expired_two_factor_codes: { Args: never; Returns: undefined }
      generate_2fa_secret: { Args: never; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_channel_admin: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_follower: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
