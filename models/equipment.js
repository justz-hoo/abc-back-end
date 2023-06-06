const mongoose = require('mongoose');
const {Schema} = mongoose;

const equipmentSchema = new Schema({
    name: String,
    cost: Number,
    usageTime: Number
});

const EquipmentModel = mongoose.model('equipments', equipmentSchema);

module.exports = EquipmentModel;