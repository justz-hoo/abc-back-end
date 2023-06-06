const mongoose = require('mongoose');
const {Schema} = mongoose;

const DrugSchema = new Schema({
    name: String,
    unitprice: Number,
});

const DrugModel = mongoose.model('drugs', DrugSchema);

module.exports = DrugModel;