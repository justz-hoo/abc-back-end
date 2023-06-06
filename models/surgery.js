const mongoose = require('mongoose');
const {Schema} = mongoose;

const surgerySchema = new Schema({
    surgeryId: {type: String, unique: true},
    surgeryDate: String,
    type: String,
    equipmentUsage: [{name: String, usage: Number}],
    stuffworktime:[{surgerypoint: String, stuffs: [{stype: String, num: Number, duration: Number}]}],
    materialUsage: [{name: String, usage: Number}],
    drugUsage: [{name: String, usage: Number}]
});

const SurgeryModel = mongoose.model('surgeries', surgerySchema);

module.exports = SurgeryModel;