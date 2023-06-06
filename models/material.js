const mongoose = require('mongoose');
const {Schema} = mongoose;

const materialSchema = new Schema({
    name: String,
    unitprice: Number,
});

const MaterialModel = mongoose.model('materials', materialSchema);

module.exports = MaterialModel;