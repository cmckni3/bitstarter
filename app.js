var express = require("express");
var app = express();
var fs = require('fs');
app.use(express.logger());

app.get('/', function(request, response) {
  var content = fs.readFileSync('index.html');
  response.send(content.toString('utf-8'));
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});
