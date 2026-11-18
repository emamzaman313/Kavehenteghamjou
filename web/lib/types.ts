export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  profile_visibility: string;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  body: string;
  visibility: string;
  comments_enabled: boolean;
  published_at: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  kind: string;
  title: string | null;
  created_by: string;
  updated_at: string;
  last_message_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  format: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type FileAsset = {
  id: string;
  owner_id: string;
  bucket_id: string;
  object_path: string;
  original_name: string;
  mime_type: string | null;
  byte_size: number;
  sha256_hex: string;
  status: string;
  created_at: string;
};
