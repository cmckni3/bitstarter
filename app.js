var express = require("express");
var app = express();
var fs = require('fs');
var morgan = require('morgan');
app.use(morgan('combined'));

var async = require('async');
var http = require('http');
var https = require('https');
var db = require('./models');

var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('port', process.env.PORT || 8080);

// Render homepage (note trailing slash): example.com/
app.get('/', function(request, response) {
  var content = fs.readFileSync('index.html');
  response.send(content.toString('utf-8'));
});

// Render example.com/orders
app.get('/orders', function(request, response) {
  global.db.Order.findAll().then(function(orders) {
    var ordersJson = [];
    orders.forEach(function(order) {
      ordersJson.push({id: order.coinbase_id, amount: order.amount, time: order.time});
    });
    // Uses views/orders.ejs
    response.render("orders", {orders: ordersJson});
  }, function(err) {
    console.log(err);
    response.send("error retrieving orders");
  });
});

// add order to the database if it doesn't already exist
var addOrder = function(orderObj, callback) {
  var order = orderObj.order; // order json from coinbase
  if (order.status !== "completed") {
    // only add completed orders
    callback();
  } else {
    var Order = global.db.Order;
    // find if order has already been added to our database
    Order.find({where: {coinbase_id: order.id}}).then(function(orderInstance) {
      if (orderInstance) {
        // order already exists, do nothing
        callback();
      } else {
        // build instance and save
          var newOrderInstance = Order.build({
          coinbase_id: order.id,
          amount: order.total_btc.cents / 100000000, // convert satoshis to BTC
          time: order.created_at
        });
          newOrderInstance.save().then(function() {
          callback();
        }, function(err) {
          callback(err);
        });
      }
    });
  }
};

// Hit this URL while on example.com/orders to refresh
app.get('/refresh_orders', function(request, response) {
  https.get("https://coinbase.com/api/v1/orders?api_key=" + process.env.COINBASE_API_KEY, function(res) {
    var body = '';
    res.on('data', function(chunk) {body += chunk;});
    res.on('end', function() {
      try {
        var ordersJson = JSON.parse(body);
        if (ordersJson.error) {
          response.send(ordersJson.error);
          return;
        }
        // add each order asynchronously
        async.forEach(ordersJson.orders, addOrder, function(err) {
          if (err) {
            console.log(err);
            response.send("error adding orders");
          } else {
            // orders added successfully
            response.redirect("/orders");
          }
        });
      } catch (error) {
        console.log(error);
        response.send("error parsing json");
      }
    });

    res.on('error', function(e) {
      console.log(e);
      response.send("error syncing orders");
    });
  });

});

// sync the database and start the server
db.sequelize.sync().complete(function(err) {
  if (err) {
    throw err;
  } else {
    http.createServer(app).listen(app.get('port'), function() {
      console.log("Listening on " + app.get('port'));
    });
  }
});

