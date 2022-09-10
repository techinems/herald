[![Build Status](https://github.com/techinems/herald/actions/workflows/main.yml/badge.svg)](https://github.com/techinems/herald/actions/workflows/main.yml/badge.svg)

[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)

# Herald

**Herald** is an application that accepts emailed text-message dispatches (TMDs), parses them, and sends them off to Slack with beautiful formatting.

### Setup

Setup of **Herald** involves a few steps, but it isn't very difficult. You'll need to create an app on Slack, load our code onto your server, and set some environment variables.

#### Slack

1. Head over to [Slack's app portal](https://api.slack.com/apps), and create a new app.
1. Add the OAuth scope `chat:write`.
1. Install the app to your workspace, and take note of the bot user token (it starts with `xoxb-` and then a ton of random characters). You'll also need the signing secret, which is available on the "basic information" page.

#### Your server

You can easily deploy this app using Docker Compose. Your `docker-compose.yml` file should look something like the following (we use [Traefik](https://traefik.io) for routing, FYI):

```
herald:
  build: https://github.com/techinems/herald.git#main
  container_name: herald
  restart: always
  labels:
    - traefik.tcp.routers.herald_smtp.service=herald_smtp
    - traefik.tcp.services.herald_smtp.loadbalancer.server.port=25
    - traefik.tcp.routers.herald_smtp.entrypoints=smtp
    - traefik.tcp.routers.herald_smtp.rule=HostSNI(`*`)
```

Fill in the environment variables as appropriate, and run a `docker-compose up -d herald`, or whatever you named your service.

## Credits

### Developers

- [Dan Bruce](https://github.com/ddbruce)

### License

**Herald** is provided under the [MIT License](https://opensource.org/licenses/MIT).

### Contact

For any question, comments, or concerns, email [tech@techinems.org](mailto:tech@techinems.org), [create an issue](https://github.com/techinems/herald/issues/new), or open up a pull request.
