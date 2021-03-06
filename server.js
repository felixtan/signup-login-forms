const https = require('https')
const fs = require('fs')
const path = require('path')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const sql = require('sql.js')
const hbs = require('express-hbs')

// HTTPS
const certDirectory = `${process.env.HOME}/.config/localhost-ssl/`
const serverOptions = {
  key: fs.readFileSync(path.join(certDirectory, 'key.pem')),
  cert: fs.readFileSync(path.join(certDirectory, 'certificate.pem'))
}

// Database
const db = new sql.Database()
db.run('CREATE TABLE users (name text, company text, email text, password text, isLocked integer);')

// Express
const app = express()

// Templating
app.engine('hbs', hbs.express4({
  partialsDir: __dirname + '/views/partials',
  defaultLayout: __dirname + '/views/index.hbs'
}));
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

// Helper functions
const helpers = require('./scripts/helpers.js')(db)

// Middleware
const passport = require('./scripts/auth.js')(db, helpers)
app.use(express.static(__dirname + '/'))
app.use(redirectToHttps)
app.use(bodyParser.urlencoded({ extended: true }))
// app.use(printRequestHeaders)
app.use(printRequestBody)
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }))
app.use(passport.initialize())
app.use(passport.session())

// Routes
const routers = require('./routes/index.js')(app, db, passport, helpers)
app.use('/', routers.home)
app.use('/signup', routers.signup)
app.use('/login', routers.login)
app.use('/password-recovery/stage1', routers.passwordRecoveryStage1)
app.use('/password-recovery/stage2', routers.passwordRecoveryStage2)
app.use('/password-recovery/stage3', routers.passwordRecoveryStage3)
app.use('/logout', routers.logout)
app.get('/page-not-found', routers.pageNotFound)
app.all('/*', (req, res) => res.status(404).redirect('/page-not-found'))

app.listen(3000, () => console.log('Listening on port 3000'))
https.createServer(serverOptions, app).listen(3001, () => console.log('Listening on port 3001'))

function printRequestHeaders(req, res, next) {
  console.log(`\nHeaders:\n${JSON.stringify(req.headers, null, 4)}`)
  next()
}

function printRequestBody(req, res, next) {
  console.log(`\nBody:\n${JSON.stringify(req.body, null, 4)}`)
  next()
}

function redirectToHttps(req, res, next) {
  if (req.protocol === 'http') {
    return res.status(301).redirect(`https://${req.hostname}:3001${req.path}`)
  }

  next()
}
