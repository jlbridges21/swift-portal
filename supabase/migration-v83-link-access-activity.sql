-- Activity log types for public link access changes
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'link_access_enabled';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'link_access_restricted';
