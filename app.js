const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const databasePath = path.join(__dirname, 'covid19IndiaPortal.db')

const app = express()

app.use(express.json())

let database = null

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDbObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
////1111
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `select * from user where username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

////2222
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `select * from state;`
  const statesArray = await database.all(getStatesQuery)
  response.send(
    statesArray.map(eachState =>
      convertStateDbObjectToResponseObject(eachState),
    ),
  )
})

////3333
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  select * from state where state_id = ${stateId};`
  const state = await database.get(getStateQuery)
  response.send(convertStateDbObjectToResponseObject(state))
})

///55555
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictsQuery = `select * from district where district_id = ${districtId};`
    const district = await database.get(getDistrictsQuery)
    response.send(convertDistrictDbObjectToResponseObject(district))
  },
)

/////////44444444444
app.post('/districts/', authenticateToken, async (request, response) => {
  const {stateId, districtName, cases, cured, active, deaths} = request.body
  const postDistrictQuery = ` insert into district (state_id, district_name, cases,
   cured, active, deaths) values
    (${stateId}, '${districtName}', ${cases} , ${cured}, ${active}, ${deaths});`
  await database.run(postDistrictQuery)
  response.send('District Successfully Added')
})

////66666
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getStateQuery = `
  delete from district where district_id = ${districtId};`
    await database.run(getStateQuery)
    response.send('District Removed')
  },
)
////////7777
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `
  update district set district_name = '${districtName}',
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  where district_id = ${districtId};`

    await database.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

///////888
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateStatsQuery = `select sum(cases), sum(cured), sum(active), sum(deaths) from
    district where state_id = ${stateId};`
    const stats = await database.get(getStateStatsQuery)
    response.send({
      totalCases: stats['sum(cases)'],
      totalCured: stats['sum(cured)'],
      totalActive: stats['sum(active)'],
      totalDeaths: stats['sum(deaths)'],
    })
  },
)

module.exports = app
