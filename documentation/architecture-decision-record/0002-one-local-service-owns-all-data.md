# One local service owns all data in SQLite

All product data lives in one SQLite file owned by one local Node service; the desktop window, the phone web app, and the harnesses reach it only through that service. This meets the local-data and single-user requirements with no server for users to install. Postgres with pgvector in Docker was rejected because it would make every user install and run Docker; vector search can come later through `sqlite-vec` in the same file.
