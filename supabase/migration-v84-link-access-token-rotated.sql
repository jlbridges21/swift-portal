-- Activity log type for public link token rotation
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'link_access_token_rotated';
