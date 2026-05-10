# ============================================================================
# Stage 1 : Build des binaires Go
# ============================================================================
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

ENV GOTOOLCHAIN=auto

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=0 GOOS=linux
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server
RUN go build -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# ============================================================================
# Stage 2 : Image runtime minimale
# ============================================================================
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY --from=builder /out/migrate /app/migrate
COPY --from=builder /build/migrations /app/migrations

EXPOSE 8080

CMD ["/bin/sh", "-c", "/app/migrate up && /app/server"]
