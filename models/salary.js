const mongoose = require('mongoose');
const {Schema} = mongoose;

const salarySchema = new Schema({
    type: {type: String, unique: true},
    num: Number,
    workday: Number,
    worktimeperday: Number,
    theorytime: Number,
    validtime: Number,
    sumsalary: Number,
    costPerMin: Number
});

const SalaryModel = mongoose.model('salaries', salarySchema);

module.exports = SalaryModel;