var mongoose = require('mongoose');

function fail(status, message) {
    var error = new Error(message);
    error.status = status;
    throw error;
}

function validId(id) {
    return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

async function findResource(Model, id, session) {
    if (!validId(id)) fail(404, Model.modelName + ' not found');
    var resource = await Model.findById(id).session(session || null);
    if (!resource) fail(404, Model.modelName + ' not found');
    return resource;
}

function bodyObject(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        fail(400, 'Request body must be an object');
    }
}

function requiredString(value, field) {
    if (typeof value !== 'string' || !value.trim()) {
        fail(400, field + ' must be a nonempty string');
    }
}

function userFields(body) {
    bodyObject(body);
    requiredString(body.name, 'Name');
    requiredString(body.email, 'Email');
    var pending = body.pendingTasks === undefined ? [] : body.pendingTasks;
    if (!Array.isArray(pending) || !pending.every(validId)) {
        fail(400, 'Pending tasks must be a list of valid task IDs');
    }
    return {
        name: body.name,
        email: body.email,
        pendingTasks: [...new Set(pending.map(id => id.toLowerCase()))]
    };
}

function taskFields(body) {
    bodyObject(body);
    requiredString(body.name, 'Name');
    if (!['string', 'number'].includes(typeof body.deadline) ||
        (typeof body.deadline === 'string' && !body.deadline.trim()) ||
        !Number.isFinite(new Date(body.deadline).getTime())) {
        fail(400, 'Deadline must be a valid date');
    }
    if (body.description !== undefined && typeof body.description !== 'string') {
        fail(400, 'Description must be a string');
    }
    if (body.completed !== undefined && typeof body.completed !== 'boolean') {
        fail(400, 'Completed must be a boolean');
    }
    var assigned = body.assignedUser === undefined ? '' : body.assignedUser;
    if (assigned !== '' && !validId(assigned)) fail(400, 'Assigned user must be a valid user ID');
    if (body.assignedUserName !== undefined && typeof body.assignedUserName !== 'string') {
        fail(400, 'Assigned user name must be a string');
    }
    return {
        name: body.name,
        description: body.description === undefined ? '' : body.description,
        deadline: new Date(body.deadline),
        completed: body.completed === undefined ? false : body.completed,
        assignedUser: assigned.toLowerCase(),
        assignedUserName: 'unassigned'
    };
}

function jsonParameter(query, key, fallback) {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== 'string') fail(400, 'Invalid ' + key + ' parameter');
    try {
        return JSON.parse(query[key]);
    } catch {
        fail(400, 'Invalid JSON in ' + key + ' parameter');
    }
}

function objectParameter(query, key) {
    var value = jsonParameter(query, key, {});
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail(400, key + ' must be a JSON object');
    }
    return value;
}

function projection(query) {
    var select = objectParameter(query, 'select');
    var entries = Object.entries(select);
    if (entries.some(([key, value]) => key.split('.').some(part => !part || part.startsWith('$')) || ![0, 1].includes(value))) {
        fail(400, 'Select values must be 0 or 1');
    }
    var modes = new Set(entries.filter(([key]) => key !== '_id').map(([, value]) => value));
    if (modes.size > 1) fail(400, 'Select cannot mix included and excluded fields');
    return select;
}

function collectionParameters(query, defaultLimit) {
    var where = objectParameter(query, 'where');
    var sort = objectParameter(query, 'sort');
    if (Object.entries(sort).some(([key, value]) => key.split('.').some(part => !part || part.startsWith('$')) || ![1, -1].includes(value))) {
        fail(400, 'Sort values must be 1 or -1');
    }
    var select = projection(query);
    var skip = jsonParameter(query, 'skip', 0);
    var limit = jsonParameter(query, 'limit', defaultLimit);
    if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isSafeInteger(limit) || limit < 0) {
        fail(400, 'Skip and limit must be nonnegative integers');
    }
    var count = jsonParameter(query, 'count', false);
    if (typeof count !== 'boolean') fail(400, 'Count must be a boolean');
    return { where, sort, select, skip, limit, count };
}

async function collection(Model, query, defaultLimit) {
    var options = collectionParameters(query, defaultLimit);
    // Count all matches before pagination; see IMPLEMENTATION_PLAN.md.
    var result = options.count ? Model.countDocuments(options.where) : Model.find(options.where)
        .sort(options.sort).select(options.select).skip(options.skip).limit(options.limit).lean();
    // Casting rejects invalid field operators before any database operation.
    try {
        result.cast(Model);
    } catch {
        fail(400, 'Invalid query field or operator');
    }
    return result;
}

async function item(Model, req) {
    if (!validId(req.params.id)) fail(404, Model.modelName + ' not found');
    var select = projection(req.query);
    var resource = await Model.findById(req.params.id).select(select).lean();
    if (!resource) fail(404, Model.modelName + ' not found');
    return resource;
}

module.exports = {
    fail, validId, findResource, userFields, taskFields,
    projection, collectionParameters, collection, item,
    transaction: operation => mongoose.connection.transaction(operation)
};
