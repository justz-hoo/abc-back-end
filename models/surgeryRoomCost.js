const mongoose = require('mongoose');
const {Schema} = mongoose;

const surgeryRoomCostSchema = new Schema({
    _id: {type: String, unique: true},
    equipmentCost: Number,
    stuffCost: Number,
    materialCost: Number,
    drugCost: Number,
    otherCost: Number,
    num: Number,
});

const SurgeryRoomCostModel = mongoose.model('surgeryroomcosts', surgeryRoomCostSchema);

module.exports = SurgeryRoomCostModel;