# Calls in interview rooms

Rooms have video and audio calls for up to 4 people, with screen sharing for
the candidate. Calls are peer to peer: video goes straight between browsers,
and the server only passes the setup messages over the room's socket. Nothing
is recorded.

## Without any setup

With no call settings, two browsers connect when they can reach each other
directly: on one network, or behind simple home routers. That covers local
development. It does not cover many offices, schools and mobile networks,
where the call shows "Connecting…" and never starts.

## With a TURN relay

A TURN server relays a call's media for people who can't connect directly.
`docker-compose.yml` runs coturn from the local `coturn/coturn:4.18.0-alpine`
image (never pulled):

```sh
# .env
TURN_SECRET=<at least 16 random characters>
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
STUN_URLS=stun:turn.example.com:3478

docker compose --profile rtc up -d coturn
```

- **Credentials expire.** The API hands each room member a TURN username and
  password signed with `TURN_SECRET`, valid for `TURN_TTL_SECONDS` (an hour
  by default). coturn checks the signature; nothing is stored. Only members of
  a room can ask for them (`GET /rooms/:id/ice-servers`).
- **Ports.** coturn listens on 3478 (UDP and TCP) and relays on UDP 49160 to
  49200. Open those on the server's firewall. It uses host networking, which
  needs Linux.
- **No reaching inside.** The relay refuses to send traffic to private and
  local addresses, so it can't be used to reach the server's own network.
- **Without a secret, coturn refuses to start.** An empty secret would let
  anyone sign their own credentials.
- **On a server behind NAT** (most cloud machines), add
  `--external-ip=<public-ip>/<private-ip>` to coturn's command.

## Limits

| | |
|---|---|
| People on a call | 4 |
| Screen share | Candidates only, one at a time each |
| Recording | None |
