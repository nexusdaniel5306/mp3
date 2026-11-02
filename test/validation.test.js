var test = require('node:test');
var assert = require('node:assert/strict');
var helpers = require('../routes/helpers');
var User = require('../models/user');
var Task = require('../models/task');
var app = require('../server');

function badRequest(operation) {
    assert.throws(operation, error => error.status === 400);
}

test('user input rejects missing fields and wrong types before casting', function () {
    for (var body of [null, [], {}, { name: 5, email: 'a' }, { name: ' ', email: 'a' },
        { name: 'A', email: false }, { name: 'A', email: 'a', pendingTasks: 'bad' },
        { name: 'A', email: 'a', pendingTasks: ['bad'] }]) {
        badRequest(() => helpers.userFields(body));
    }
    var id = 'ABCDEF012345678901234567';
    assert.deepEqual(helpers.userFields({ name: 'A', email: 'a', pendingTasks: [id, id.toLowerCase()] }), {
        name: 'A', email: 'a', pendingTasks: [id.toLowerCase()]
    });
});

test('task input validates dates and optional types, and reapplies defaults', function () {
    var base = { name: 'Task', deadline: '2026-11-03T00:00:00.000Z' };
    for (var extra of [{ name: null }, { deadline: null }, { deadline: false }, { deadline: {} },
        { deadline: '' }, { deadline: 'not a date' }, { description: [] }, { completed: 'false' },
        { assignedUser: null }, { assignedUser: 'bad' }, { assignedUserName: 7 }]) {
        badRequest(() => helpers.taskFields({ ...base, ...extra }));
    }
    assert.deepEqual(helpers.taskFields({ ...base, dateCreated: '2000-01-01' }), {
        ...base, deadline: new Date(base.deadline), description: '', completed: false,
        assignedUser: '', assignedUserName: 'unassigned'
    });
    assert.equal(helpers.taskFields({ name: 'Numeric date', deadline: 0 }).deadline.getTime(), 0);
});

test('collection query combinations are parsed without coercing invalid values', function () {
    assert.deepEqual(helpers.collectionParameters({
        where: '{"completed":true}', sort: '{"name":-1}', select: '{"name":1,"_id":0}',
        skip: '2', limit: '5', count: 'true'
    }, 100), {
        where: { completed: true }, sort: { name: -1 }, select: { name: 1, _id: 0 },
        skip: 2, limit: 5, count: true
    });
    for (var query of [{ where: '{' }, { where: 'null' }, { sort: '[]' }, { sort: '{"name":0}' },
        { select: '{"name":2}' }, { select: '{"$bad":1}' }, { sort: '{"$bad":1}' },
        { select: '{"name":1,"email":0}' }, { skip: '-1' },
        { limit: '1.5' }, { count: '1' }, { count: '"true"' }, { limit: ['1', '2'] }]) {
        badRequest(() => helpers.collectionParameters(query, 100));
    }
    assert.equal(helpers.collectionParameters({}, 100).limit, 100);
    assert.equal(helpers.collectionParameters({}, 0).limit, 0);
});

test('invalid field operators fail before a database query', async function () {
    await assert.rejects(helpers.collection(Task, { where: '{"name":{"$invalid":1}}' }, 100),
        error => error.status === 400 && error.message === 'Invalid query field or operator');
});

test('models expose required defaults and server-created timestamps', async function () {
    var user = new User({ name: 'A', email: 'a' });
    var task = new Task({ name: 'T', deadline: new Date() });
    assert.deepEqual(user.pendingTasks.toObject(), []);
    assert.equal(task.description, '');
    assert.equal(task.completed, false);
    assert.equal(task.assignedUser, '');
    assert.equal(task.assignedUserName, 'unassigned');
    assert.ok(user.dateCreated instanceof Date);
    assert.ok(task.dateCreated instanceof Date);
    await assert.rejects(new Task().validate());
    await assert.rejects(new User().validate());
});

test('HTTP parsing, 404s and CORS return safe responses without a database', async function (t) {
    var server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    var base = 'http://127.0.0.1:' + server.address().port;
    for (var path of ['/api/users/bad-id', '/api/tasks/bad-id', '/missing']) {
        var response = await fetch(base + path);
        assert.equal(response.status, 404);
        assert.equal((await response.json()).data, null);
    }
    var root = await (await fetch(base + '/api')).json();
    assert.deepEqual(root, { message: 'Task management API', data: null });
    var malformed = await fetch(base + '/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { message: 'Request body must contain valid JSON', data: null });
    var query = await fetch(base + '/api/tasks?count=invalid');
    assert.equal(query.status, 400);
    var preflight = await fetch(base + '/api/users', { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
});
