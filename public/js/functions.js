exports.removeObject = function (object, removeKey) {
	for (key in object) {
        var user = object[key];
        var _key = user.client_id;

        if (removeKey == _key) {
        	object.splice(key, 1);
        	return;
        }
    }
}

exports.findByKey = function (object, key, value) {
	for (_key in object) {
		var _object = object[_key];

		if (_object[key] == value) {
			return _object;
		}
	}

	return null;
}