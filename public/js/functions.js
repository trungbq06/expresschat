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