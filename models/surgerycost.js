const mongoose = require('mongoose');
const {Schema} = mongoose;

const surgerycostSchema = new Schema({
    surgeryId: {type: String, unique: true},
    surgeryDate: String,
    type: String,
    equipmentCost: Number,
    stuffCost: Number,
    stuffCostBefore: Number,
    stuffCostDuring: Number,
    stuffCostAfter: Number,
    materialCost: Number,
    drugCost: Number,
    otherCost: Number
});

const SurgeryCostModel = mongoose.model('surgerycosts', surgerycostSchema);

module.exports = SurgeryCostModel;