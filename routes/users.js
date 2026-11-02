var express = require('express');
var User = require('../models/user');
var Task = require('../models/task');
var helpers = require('./helpers');
var router = express.Router();

async function writeUser(req, replacing) {
    return helpers.transaction(async function (session) {
        var user = replacing ? await helpers.findResource(User, req.params.id, session) : new User();
        var fields = helpers.userFields(req.body);
        var duplicate = await User.exists({ email: fields.email, _id: { $ne: user._id } }).session(session);
        if (duplicate) helpers.fail(400, 'Email is already in use');
        var tasks = await Task.find({ _id: { $in: fields.pendingTasks } }).session(session);
        if (tasks.length !== fields.pendingTasks.length) helpers.fail(404, 'A pending task was not found');
        if (tasks.some(task => task.completed)) helpers.fail(400, 'Completed tasks cannot be pending');

        var id = user._id.toString();
        var removed = user.pendingTasks.filter(taskId => !fields.pendingTasks.includes(taskId));
        await Task.updateMany({ _id: { $in: removed }, assignedUser: id }, {
            $set: { assignedUser: '', assignedUserName: 'unassigned' }
        }, { session });
        await User.updateMany({ _id: { $ne: user._id }, pendingTasks: { $in: fields.pendingTasks } }, {
            $pull: { pendingTasks: { $in: fields.pendingTasks } }
        }, { session });
        await Task.updateMany({ _id: { $in: fields.pendingTasks } }, {
            $set: { assignedUser: id, assignedUserName: fields.name }
        }, { session });
        // Completed tasks retain assignment and follow user renames too.
        await Task.updateMany({ assignedUser: id }, {
            $set: { assignedUserName: fields.name }
        }, { session });
        user.set(fields);
        await user.save({ session });
        return user.toObject();
    });
}

router.get('/', async function (req, res) {
    res.json({ message: 'OK', data: await helpers.collection(User, req.query, 0) });
});

router.post('/', async function (req, res) {
    res.status(201).json({ message: 'User created', data: await writeUser(req, false) });
});

router.get('/:id', async function (req, res) {
    res.json({ message: 'OK', data: await helpers.item(User, req) });
});

router.put('/:id', async function (req, res) {
    res.json({ message: 'User updated', data: await writeUser(req, true) });
});

router.delete('/:id', async function (req, res) {
    var deleted = await helpers.transaction(async function (session) {
        var user = await helpers.findResource(User, req.params.id, session);
        await Task.updateMany({ assignedUser: user._id.toString() }, {
            $set: { assignedUser: '', assignedUserName: 'unassigned' }
        }, { session });
        await user.deleteOne({ session });
        return user.toObject();
    });
    // Provisional DELETE choice: 200 preserves the required JSON envelope.
    res.json({ message: 'User deleted', data: deleted });
});

module.exports = router;
