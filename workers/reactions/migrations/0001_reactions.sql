CREATE TABLE reaction_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  signing_key TEXT NOT NULL
);
-- Generated inside D1: never placed in Actions logs or source control.
INSERT INTO reaction_config VALUES (1, lower(hex(randomblob(32))));
CREATE TABLE reaction_articles (
  slug TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0)
);
INSERT INTO reaction_articles (slug) VALUES ('why-we-work');
CREATE TABLE reactions (
  slug TEXT NOT NULL REFERENCES reaction_articles(slug),
  visitor TEXT NOT NULL,
  PRIMARY KEY (slug, visitor)
);
CREATE TRIGGER reaction_added AFTER INSERT ON reactions BEGIN
  UPDATE reaction_articles SET likes = likes + 1 WHERE slug = NEW.slug;
END;
CREATE TRIGGER reaction_removed AFTER DELETE ON reactions BEGIN
  UPDATE reaction_articles SET likes = likes - 1 WHERE slug = OLD.slug;
END;
CREATE TABLE reaction_limits (
  key TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  requests INTEGER NOT NULL
);
CREATE INDEX reaction_limits_expiry ON reaction_limits(expires);
