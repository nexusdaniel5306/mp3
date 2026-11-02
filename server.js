// Get the packages we need
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose');

// Read .env file
require('dotenv').config({ quiet: true });

// Create our Express application
var app = express();

// Use environment defined port or 3000
var port = process.env.PORT || 3000;

// Allow CORS so that backend and frontend could be put on different servers
var allowCrossDomain = function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
};
app.use(allowCrossDomain);

// Parse URL-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use routes as a module (see index.js)
require('./routes')(app, router);

app.use(function (req, res) {
    res.status(404).json({ message: 'Endpoint not found', data: null });
});

app.use(function (error, req, res, next) {
    var status = error.status || 500;
    var message = status === 500 ? 'Unable to complete the request' : error.message;
    if (error.code === 11000) {
        status = 400;
        message = 'Email is already in use';
    } else if (error.type === 'entity.parse.failed') {
        status = 400;
        message = 'Request body must contain valid JSON';
    } else if (error.name === 'CastError' || error.name === 'ValidationError') {
        status = 400;
        message = 'Invalid field value';
    } else if (error.name === 'MongoServerError' && [2, 9, 14, 72, 15999, 31254].includes(error.code)) {
        status = 400;
        message = 'Invalid query';
    }
    res.status(status).json({ message: message, data: null });
});

async function start() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
        await require('./models/user').init();
        await require('./models/task').init();
        app.listen(port, function () {
            console.log('Server running on port ' + port);
        });
    } catch {
        console.error('Unable to connect to the database. Check the private environment configuration and Atlas access.');
        await mongoose.disconnect();
        process.exitCode = 1;
    }
}

if (require.main === module) start();

module.exports = app;
