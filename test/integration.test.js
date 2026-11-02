var test = require('node:test');
var assert = require('node:assert/strict');
var mongoose = require('mongoose');
var app = require('../server');
var User = require('../models/user');
var Task = require('../models/task');

// Explicit opt-in: uses the configured database, creates uniquely named fixtures,
// and removes only their recorded IDs. It never drops a database or collection.
test('Atlas API integration', { skip: process.env.MP3_INTEGRATION !== '1' }, async function (t) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    var server;
    var userIds = new Set();
    var taskIds = new Set();
    t.after(async function () {
        try {
            await Task.deleteMany({ _id: { $in: [...taskIds] } });
            await User.deleteMany({ _id: { $in: [...userIds] } });
        } finally {
            if (server) await new Promise(resolve => server.close(resolve));
            await mongoose.disconnect();
        }
    });
    await User.init();
    await Task.init();
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    var base = 'http://127.0.0.1:' + server.address().port + '/api';
    var prefix = 'mp3-test-' + crypto.randomUUID();
    var missing = new mongoose.Types.ObjectId().toString();
    var deadline = '2026-11-03T12:00:00.000Z';

    async function request(method, path, body, status = method === 'DELETE' ? 204 : 200) {
        var response = await fetch(base + path, {
            method, headers: { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (status === 204) {
            assert.equal(response.status, 204, method + ' ' + path);
            assert.equal(await response.text(), '', '204 response must have no body');
            return;
        }
        var result = await response.json();
        assert.equal(typeof result.message, 'string');
        assert.ok(Object.hasOwn(result, 'data'));
        assert.equal(response.status, status, method + ' ' + path + ': ' + result.message);
        if (method === 'POST' && response.status === 201) {
            (path === '/users' ? userIds : taskIds).add(result.data._id);
        }
        return result.data;
    }
    function query(path, params) {
        return path + '?' + new URLSearchParams(Object.entries(params).map(([key, value]) => [key, JSON.stringify(value)]));
    }
    var a;
    var b;
    var pending;
    var completed;

    await t.test('creation, validation, reference errors and replacement defaults', async function () {
        a = await request('POST', '/users', { name: prefix + '-A', email: prefix + '-a@example.com', dateCreated: '2000-01-01' }, 201);
        b = await request('POST', '/users', { name: prefix + '-B', email: prefix + '-b@example.com' }, 201);
        assert.deepEqual(a.pendingTasks, []);
        assert.notEqual(a.dateCreated, '2000-01-01T00:00:00.000Z');
        await request('POST', '/users', { name: 'Duplicate', email: a.email }, 400);
        await request('POST', '/users', { name: 1, email: 'a' }, 400);
        await request('POST', '/tasks', { name: 'T', deadline, completed: 'false' }, 400);
        await request('POST', '/tasks', { name: 'T', deadline, assignedUser: 'bad' }, 400);
        await request('POST', '/tasks', { name: 'T', deadline, assignedUser: missing }, 404);
        await request('POST', '/users', { name: 'T', email: prefix, pendingTasks: [missing] }, 404);
        for (var resource of ['users', 'tasks']) {
            for (var id of ['bad', missing]) {
                await request('GET', '/' + resource + '/' + id, undefined, 404);
                await request('PUT', '/' + resource + '/' + id, {}, 404);
                await request('DELETE', '/' + resource + '/' + id, undefined, 404);
            }
        }
        pending = await request('POST', '/tasks', { name: prefix + '-pending', deadline, description: 'old', assignedUser: a._id }, 201);
        completed = await request('POST', '/tasks', { name: prefix + '-done', deadline, completed: true, assignedUser: a._id }, 201);
        assert.equal(pending.assignedUserName, a.name);
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, [pending._id]);
        var replaced = await request('PUT', '/tasks/' + pending._id, { name: pending.name, deadline, dateCreated: '2000-01-01' });
        assert.equal(replaced.dateCreated, pending.dateCreated);
        assert.equal(replaced.description, '');
        assert.equal(replaced.completed, false);
        assert.equal(replaced.assignedUser, '');
        assert.equal(replaced.assignedUserName, 'unassigned');
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, []);
    });

    await t.test('task assignment, completion, reopening and moving completed tasks', async function () {
        async function put(fields) {
            return request('PUT', '/tasks/' + pending._id, { name: pending.name, deadline, ...fields });
        }
        await put({ assignedUser: a._id });
        await request('PUT', '/tasks/' + pending._id, { name: pending.name, deadline, assignedUser: a._id, assignedUserName: b.name }, 400);
        await put({ assignedUser: b._id });
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, []);
        assert.deepEqual((await request('GET', '/users/' + b._id)).pendingTasks, [pending._id]);
        await put({ assignedUser: b._id, completed: true });
        assert.deepEqual((await request('GET', '/users/' + b._id)).pendingTasks, []);
        await put({ assignedUser: a._id, completed: true });
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, []);
        await put({ assignedUser: a._id, completed: false });
        await put({ assignedUser: a._id, completed: false });
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, [pending._id]);
    });

    await t.test('user PUT moves pending tasks, renames completed tasks, and preserves failed state', async function () {
        var before = await request('GET', '/users/' + a._id);
        await request('PUT', '/users/' + a._id, { name: a.name, email: b.email, pendingTasks: [missing] }, 400);
        await request('PUT', '/users/' + a._id, { name: a.name, email: a.email, pendingTasks: [completed._id, missing] }, 404);
        await request('PUT', '/users/' + a._id, { name: a.name, email: a.email, pendingTasks: [completed._id] }, 400);
        assert.deepEqual(await request('GET', '/users/' + a._id), before);
        a = await request('PUT', '/users/' + a._id, { name: a.name + '-renamed', email: a.email, pendingTasks: [pending._id] });
        assert.equal(a.dateCreated, before.dateCreated);
        assert.equal((await request('GET', '/tasks/' + completed._id)).assignedUserName, a.name);
        b = await request('PUT', '/users/' + b._id, { name: b.name, email: b.email, pendingTasks: [pending._id, pending._id] });
        assert.deepEqual(b.pendingTasks, [pending._id]);
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, []);
        assert.equal((await request('GET', '/tasks/' + pending._id)).assignedUser, b._id);
        await request('PUT', '/users/' + b._id, { name: b.name, email: b.email });
        assert.equal((await request('GET', '/tasks/' + pending._id)).assignedUser, '');
        var c = await request('POST', '/users', { name: prefix + '-C', email: prefix + '-c@example.com', pendingTasks: [pending._id] }, 201);
        assert.equal((await request('GET', '/tasks/' + pending._id)).assignedUser, c._id);
        await request('PUT', '/tasks/' + pending._id, { name: pending.name, deadline, assignedUser: b._id });
        var d = await request('POST', '/users', { name: prefix + '-D', email: prefix + '-d@example.com', pendingTasks: [pending._id] }, 201);
        assert.deepEqual((await request('GET', '/users/' + b._id)).pendingTasks, []);
        assert.equal((await request('GET', '/tasks/' + pending._id)).assignedUser, d._id);
    });

    await t.test('a database failure after writes rolls the entire mutation back', async function () {
        var oldTask = await request('GET', '/tasks/' + pending._id);
        var oldOwner = await request('GET', '/users/' + oldTask.assignedUser);
        var oldTarget = await request('GET', '/users/' + a._id);
        var updateOne = User.updateOne;
        User.updateOne = function (filter, update, options) {
            if (update.$addToSet) return Promise.reject(new Error('Controlled test failure'));
            return updateOne.call(this, filter, update, options);
        };
        try {
            await request('PUT', '/tasks/' + pending._id, { name: 'Must roll back', deadline, assignedUser: a._id }, 500);
        } finally {
            User.updateOne = updateOne;
        }
        assert.deepEqual(await request('GET', '/tasks/' + pending._id), oldTask);
        assert.deepEqual(await request('GET', '/users/' + oldOwner._id), oldOwner);
        assert.deepEqual(await request('GET', '/users/' + a._id), oldTarget);
    });

    await t.test('database-side query combinations, defaults, count, and item projection', async function () {
        var users = await User.insertMany(Array.from({ length: 101 }, (_, i) => ({
            name: prefix + '-bulk-' + String(i).padStart(3, '0'), email: prefix + '-bulk-' + i + '@example.com'
        })));
        users.forEach(user => userIds.add(user._id.toString()));
        var tasks = await Task.insertMany(users.map(user => ({ name: user.name, deadline })));
        tasks.forEach(task => taskIds.add(task._id.toString()));
        var where = { _id: { $in: tasks.map(task => task._id.toString()) } };
        assert.equal((await request('GET', query('/tasks', { where }))).length, 100);
        assert.equal((await request('GET', query('/tasks', { where, limit: 0 }))).length, 101);
        assert.equal(await request('GET', query('/tasks', { where, skip: 100, limit: 1, count: true })), 101);
        assert.equal((await request('GET', query('/users', { where: { _id: { $in: users.map(user => user._id.toString()) } } }))).length, 101);
        var rows = await request('GET', query('/tasks', { where, sort: { name: -1 }, select: { name: 1, _id: 0 }, skip: 1, limit: 2, count: false }));
        assert.deepEqual(rows, [{ name: prefix + '-bulk-099' }, { name: prefix + '-bulk-098' }]);
        for (var resource of ['users', 'tasks']) {
            var id = resource === 'users' ? a._id : pending._id;
            var name = (await request('GET', '/' + resource + '/' + id)).name;
            assert.deepEqual(await request('GET', '/' + resource + '/' + id + '?select=%7B%22name%22%3A1%2C%22_id%22%3A0%7D&where=invalid&count=invalid'), { name });
            assert.deepEqual(await request('GET', query('/' + resource, { where: { _id: missing } })), []);
            assert.equal(await request('GET', query('/' + resource, { where: { _id: missing }, count: true })), 0);
            var excluded = await request('GET', query('/' + resource + '/' + id, { select: { _id: 0 } }));
            assert.equal(excluded._id, undefined);
            await request('GET', '/' + resource + '?where=invalid', undefined, 400);
            await request('GET', query('/' + resource, { where: { $invalid: 1 } }), undefined, 400);
            await request('GET', query('/' + resource, { where: { name: { $invalid: 1 } } }), undefined, 400);
            await request('GET', query('/' + resource, { select: { name: 1, dateCreated: 0 } }), undefined, 400);
        }
        var done = await request('GET', query('/tasks', { where: { _id: { $in: [...taskIds] }, completed: true } }));
        assert.deepEqual(done.map(task => task._id), [completed._id]);
    });

    await t.test('deletion cleans pending and completed references and returns empty 204', async function () {
        var task = await request('POST', '/tasks', { name: prefix + '-delete', deadline, assignedUser: a._id }, 201);
        await request('DELETE', '/tasks/' + task._id);
        assert.deepEqual((await request('GET', '/users/' + a._id)).pendingTasks, []);
        await request('GET', '/tasks/' + task._id, undefined, 404);
        await request('DELETE', '/tasks/' + task._id, undefined, 404);
        await request('PUT', '/tasks/' + pending._id, { name: pending.name, deadline, assignedUser: a._id });
        await request('DELETE', '/users/' + a._id);
        for (var id of [pending._id, completed._id]) {
            var unassigned = await request('GET', '/tasks/' + id);
            assert.equal(unassigned.assignedUser, '');
            assert.equal(unassigned.assignedUserName, 'unassigned');
        }
        await request('DELETE', '/users/' + a._id, undefined, 404);
    });
});
