const readline = require("readline");
const pg = require("pg");

// Details for local postgres db connection
const client = new pg.Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'root',
  port: 5432,
})
client.connect()

// Init readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get user input
const start = () => {
  rl.write("Enter command (Add, Read, Default, Close) or press CTRL-C to close: \n")
  rl.prompt()
}

// Interpret user input
rl.on("line", (input) => {
  switch (input.toLowerCase()) {
    case "add": {
      addOps();
      break;
    }
    case "read": {
      readOps();
      break;
    }
    case "default": {
      defaultOps();
      break;
    }
    case "close": {
      rl.close()
      break;
    }
    default:
      break;
  }
}).on("close", () => {
  process.exit(0);
})

// Mock INSERT operation, gets vehicle details from user and adds it to the db
const addOps = () => {
  console.log("------------------------------------------------");
  const query = "INSERT INTO vehicles(model, xCoord, yCoord, zCoord, ownerId) VALUES($1, $2, $3, $4, $5) RETURNING *";
  const values = []
  rl.question("Vehicle model? (String): ", (model) => {
    values.push(model);
    rl.question("X coordinate? (2 decimal float): ", (x) => {
      values.push(x);
      rl.question("Y coordinate? (2 decimal float): ", (y) => {
        values.push(y);
        rl.question("Z coordinate? (2 decimal float): ", (z) => {
          values.push(z);
          rl.question("Owner id? (int): ", (id) => {
            values.push(id);
            client.query(query, values, (err, res) => {
              if ( err ) {
                console.log(err.stack);
                start();
              } else {
                console.log("Success");
                console.log(res.rows[0]);
                console.log("------------------------------------------------");
                start()
              }
            })
          })
        })
      })
    })
  })
}

// Mock read operation, gets account id from user and tries to find vehicles related to that account from db
const readOps = () => {
  console.log("------------------------------------------------");
  const query = "SELECT * FROM vehicles WHERE ownerId = $1";
  let id = [0];
  let maxId = 0;
  client
    .query("SELECT id FROM accounts")
    .then(res => {
      maxId = res.rows[res.rows.length - 1].id
      rl.question(`Enter account id you want to get vehicles for (Between 1 and ${maxId}): `, (searched) => {
        id[0] = searched;
        client.query(query, id, (err, res) => {
          if ( err ) {
            console.log(err.stack);
            start();
          } else {
            console.log("Success");
            if (res.rowCount == 0) {
              console.log("No values match query");
            } else {
              res.rows.forEach(value => {
                console.log(value)
              });
            }
            console.log("------------------------------------------------");
            start();
          }
        })
      })
    })
    .catch(e => console.error(e.stack))
}

// Default operations
// 1. Gets vehicles for randomly generated account id between 1 and maxId in db
// 2. Gets the prices for the users vehicles if any were found
// 3. Adds a random new vehicle in a random location for the user picked previously
// 4. Changes the price of the randomly picked vehicle model to a number between 1 and 1000000
// 5. Outputs the new price
const defaultOps = () => {
  console.log("------------------------------------------------");
  client
    .query("SELECT id FROM accounts")
    .then(res => {
      const randomId = Math.floor(Math.random() * (res.rows[res.rows.length - 1].id + 1)) + 1;
      console.log(`Vehicles for randomly picked id ${randomId}:`);
      client.query("SELECT * FROM vehicles WHERE ownerId = $1", [randomId], (err, res) => {
        if ( err ) {
          console.log(err.stack)
          start();
        } else {
          console.log(res.rows);
          console.log(`Prices for the vehicles, if any were found: `);
          if ( res.rowCount > 0) {
            res.rows.forEach(value => {
              client.query("SELECT price FROM vehicleData WHERE model = $1", [value.model], (err, res) => {
                if ( err ) {
                  console.log(err.stack);
                  start();
                } else {
                  console.log(`Price for ${value.model}: $${res.rows[0].price}`);
                }
              })
            })
          }
          console.log(`Adding new vehicle at random location for account id ${randomId}`);
          let randomModel = "";
          client
            .query("SELECT model FROM vehicleData")
            .then(res => {
              randomModel = res.rows[Math.floor(Math.random() * res.rows.length - 1) + 1].model
              client
                .query("INSERT INTO vehicles(model, xCoord, yCoord, zCoord, ownerId) VALUES($1, $2, $3, $4, $5) RETURNING *", 
                      [randomModel, 
                      Math.floor(Math.random() * 1000 + 1) + 1,
                      Math.floor(Math.random() * 1000 + 1) + 1,
                      Math.floor(Math.random() * 1000 + 1) + 1,
                      randomId])
                .then(res => {
                  console.log(`Changing the price to a random one between 1 and 1000000 for vehicle model ${randomModel}`);
                  client
                    .query("SELECT price FROM vehicleData WHERE model = $1", [randomModel])
                    .then(res => {
                      console.log(`Current price for ${randomModel}: $${res.rows[0].price}`);
                      client
                        .query("UPDATE vehicleData SET price = $1 WHERE model = $2", [Math.floor(Math.random() * 1000001) + 1, randomModel])
                        .then(res => {
                          client
                            .query("SELECT price FROM vehicleData WHERE model = $1", [randomModel])
                            .then(res => {
                              console.log(`New price for ${randomModel}: $${res.rows[0].price}`);
                              console.log("------------------------------------------------");
                              start();
                            })
                            .catch(err => console.error(err.stack))
                            start();
                        })
                        .catch(err => console.error(err.stack))
                        start();
                    })
                    .catch(err => console.error(err.stack))
                    start();
                })
                .catch(err => console.error(err.stack))
                start();
            })
            .catch(err => console.error(err.stack))
            start();
        }
      })
    })
    .catch(e => console.error(e.stack))
    start();
}

start()