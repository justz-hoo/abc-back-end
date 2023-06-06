const mongoose = require('mongoose');
const {Schema} = mongoose;

const OtherSchema = new Schema({
    name: String, 
    managecost: Number,
    unusedcost: Number
});

const OtherModel = mongoose.model('others', OtherSchema);

module.exports = OtherModel;