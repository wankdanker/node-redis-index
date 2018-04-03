local intersectCount = redis.call("zinterstore", "temp", 2, KEYS[2], KEYS[3], "weights", 1, 0)
local unionCount = redis.call("zunionstore", KEYS[1], 2, KEYS[2], "temp", "weights", 1, -1)
local removedCount = redis.call("zremrangebyscore", KEYS[1], 0, 0)
local res = redis.call("del", "temp")
local count = redis.call("zcount", KEYS[1], "-inf", "+inf")

return count
