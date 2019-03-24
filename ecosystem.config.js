module.exports = {
  apps : [
      {
        name: "main",
        script: "./main.js",
        watch: true,
        env: {
            "PORT": 3000,
            "NODE_ENV": "development",
            "KEY": "../wss/key.pem",
            "CERT": "../wss/cert.pem"
        },
        env_production: {
            "PORT": 80,
            "NODE_ENV": "production",
        }
      }
  ]
}
