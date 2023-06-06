const express = require("express");
const app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const { Mongoose } = require("mongoose");
const Surgery = require('./models/surgery');
const Equipment = require('./models/equipment');
const SurgeryCost = require('./models/surgerycost');
const Material = require('./models/material');
const Stuff = require('./models/salary');
const Drug = require('./models/drug');
const Other = require('./models/other');
const SurgeryRoom = require('./models/surgeryRoomCost');

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
}));
app.use(express.json());

console.log(process.env.MONGO_URL);
mongoose.connect(process.env.MONGO_URL);


app.get("/test", (req, res) => {
    res.json('test, ok');
});


/*
TODO: surgery和surgeryCost计算部分
*/

// 护士先输入手术数据，创建手术数据id
app.post("/inputsurgery", async(req, res) => {
    try {
        const data = req.body;
        console.log(data.surgeryId);
        const surgeryDoc = await Surgery.findOne({surgeryId: data.surgeryId});
        // 如果有数据库中存在该次手术的id，则不更新
        if (surgeryDoc) {
            // console.log('数据库中存在数据');
            // await Surgery.updateOne({surgeryId: data.surgeryId}, {$set: data});
            res.status(200).json('数据库中存在该手术编号，请输入新的手术数据');
        }
        // 如果数据库中不存在盖茨手术手术id，则新建手术记录
        else {
            const surgeryDoc = await Surgery.create(
                data
            );
            res.status(200).json('添加手术记录成功');
        }
        res.json(surgeryDoc);

    } catch (e) {
        res.status(422).json(e);
    }
})



// 2）更新每一台手术的设备成本
const updateSingleSurgery = async() => {
    const allSurgeries = await Surgery.find({});
    allSurgeries.forEach(async (surgery, index) => {
        // console.log(index, surgery.equipmentUsage);
        const surgeryId = surgery.surgeryId;
        const equipments = surgery.equipmentUsage;
        // console.log(surgeryId, equipments);
        // 计算出该手术的所有设备成本
        let sumCost = 0;
        console.log(equipments);
        equipments.forEach(async (equip, index) => {
            const tmpEquip = await Equipment.findOne({name: equip.name});
            if (tmpEquip && tmpEquip.usageTime !== 0) {
                const curCost = tmpEquip.cost * equip.usage / tmpEquip.usageTime;
                sumCost += curCost;
                console.log(sumCost);
            }
            else {
                console.log('cal error');
            }
        });
        setTimeout(async () => {
            const ifExistInSurCost = await SurgeryCost.findOne({surgeryId: surgeryId});
            if (ifExistInSurCost) {
                console.log('sunCost', surgeryId, sumCost);
                await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {equipmentCost: sumCost}});   
            }
            else {
                console.log('sumCost', surgeryId, sumCost);
                console.log('can not find the surgeryId');
            }
       }, 60)
    })
}

// 更新手术的设备成本
const updateEquipmentCost = async (curSurgery) => {
    // console.log(curSurgery.equipmentUsage);
    const equipments = curSurgery.equipmentUsage;
    // 1）更新设备总用时
    equipments.forEach(async (equip, index) => {
        const curEquip = await Equipment.findOne({name: equip.name});
        const newUsageTime = curEquip.usageTime + equip.usage;
        await Equipment.updateOne({name: equip.name}, {$set: {usageTime: newUsageTime}})
    });

    setTimeout(() => {
        updateSingleSurgery();
    }, 10)
}


// 更新不收费卫生材料成本
const updateMaterialCost = async(curSurgery) => {
    const materials = curSurgery.materialUsage;
    const surgeryId = curSurgery.surgeryId;
    console.log(materials);
    let sumCost = 0;
    materials.forEach(async (material, index) => {
        const unitprice = await Material.findOne({name: material.name}).then((res) => res.unitprice);
        const number = material.usage;
        const curCost = number * unitprice;
        sumCost += curCost;
    });

    setTimeout(async () => {
        const ifExistInSurCost = await SurgeryCost.findOne({surgeryId: surgeryId}) ? true : false;
        if (ifExistInSurCost) {
            await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {materialCost: sumCost}});   
        }
    }, 10)

}


// 更新麻醉材料成本
const updateDrugCost = async(curSurgery) => {
    const drugs = curSurgery.drugUsage;
    const surgeryId = curSurgery.surgeryId;

    let sumCost = 0;
    for (let drug of drugs) {
        const unitprice = await Drug.findOne({name: drug.name}).then((res) => res.unitprice);
        const number = drug.usage;
        const curCost = number * unitprice;
        sumCost += curCost;
    }

    const ifExistInSurCost = await SurgeryCost.findOne({surgeryId: surgeryId});
    if (ifExistInSurCost) {
        console.log(sumCost);
        await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {drugCost: sumCost}});   
    }
}


// 更新数据库中不同种类医护人员的单位成本
const updateAllStuffUnitCost = async () => {
    const stuffs = await Stuff.find({});
    stuffs.forEach(async (stuff, index) => {
        const costPerMin = stuff.sumsalary / (stuff.validtime * stuff.num);
        await Stuff.updateOne({_id: stuff._id}, {$set: {costPerMin: costPerMin}});
    });
}


// 更新本台手术的人员成本
const updateStuffCost = async(curSurgery) => {
    // 更新人员单位成本
    // await updateAllStuffUnitCost();
    // console.log(curSurgery.stuffworktime);
    const surgeryId = curSurgery.surgeryId;
    const stuffsAllTime = curSurgery.stuffworktime;
    let sumCostBefore = 0;
    let sumCostDuring = 0;
    let sumCostAfter = 0;
    const docPerMin = await Stuff.findOne({type: '医生'}).then((res) => res.costPerMin);
    const nursePerMin = await Stuff.findOne({type: '护士'}).then((res) => res.costPerMin);
    const carerPerMin = await Stuff.findOne({type: '护工'}).then((res) => res.costPerMin);

    stuffsAllTime.forEach(async (curTimeStuffs, index) => {
        // console.log(curTimeStuffs.stuffs);
        // console.log(curTimeStuffs.surgerypoint);
        const stuffs = curTimeStuffs.stuffs;
        const surgerypoint = curTimeStuffs.surgerypoint;
        // 计算这个手术过程的人员工资
        let curTimeCost = 0;
        stuffs.forEach((stuff, index) => {
            if (stuff.stype === '医生') curTimeCost += stuff.duration * stuff.num * docPerMin;
            else if (stuff.stype === '护工') curTimeCost += stuff.duration * stuff.num * carerPerMin;
            else if (stuff.stype === '护士') curTimeCost += stuff.duration * stuff.num * nursePerMin;
        });
        if (surgerypoint === '术前准备') {
            await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {stuffCostBefore: curTimeCost}});
            sumCostBefore = curTimeCost;
            console.log(sumCostBefore);
        }
        else if (surgerypoint === '手术中') {
            await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {stuffCostDuring: curTimeCost}});
            sumCostDuring = curTimeCost;
            console.log(sumCostDuring);
        }
        else if (surgerypoint === '术后复苏') {
            await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {stuffCostAfter: curTimeCost}});
            sumCostAfter = curTimeCost;
            console.log(sumCostAfter);
        } 
    });
    
    setTimeout(async() => {
        const surgery = await SurgeryCost.findOne({surgeryId: surgeryId});
        if (surgery) await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: { stuffCost: sumCostAfter + sumCostBefore + sumCostDuring}})
    }, 10)

}

// 更新其他成本
const updateOtherCost = async(curSurgery) => {
    const surgeryId = curSurgery.surgeryId;
    const allOthers = await Other.find({});
    // console.log(allOthers);
    let sumOther = 0;
    for (const other of allOthers) {
        sumOther += other.managecost + other.unusedcost;
    }
    // console.log(curSurgery.stuffworktime);
    const stuffsAllTime = curSurgery.stuffworktime;
    // console.log(stuffsAllTime);
    let nurseTime = 0;
    for (const curTimeStuffs of stuffsAllTime) {
        const stuffs = curTimeStuffs.stuffs;
        const surgerypoint = curTimeStuffs.surgerypoint;
        // console.log(curTimeStuffs); 
        for (const stuff of stuffs) {
            if (stuff.stype === '护士') {
                // TODO：这里也需要修改
                nurseTime += stuff.duration * stuff.num;
            }
        }
    }
    const nurseSumTime = await Stuff.findOne({type: '护士'}).then((res) => res.validtime);
    const otherCost = sumOther / nurseSumTime * nurseTime;
    console.log(nurseTime);
    // console.log(surgeryId);
    await SurgeryCost.updateOne({surgeryId: surgeryId}, {$set: {otherCost: otherCost}});
}


const calCost = async (surgeryId) => {
    try {
        const surgeryDoc = await Surgery.findOne({surgeryId: surgeryId});
        const allSurgeries = await Surgery.find({});
        if (surgeryDoc) {
            // surgerycost数据库中新建记录
            const ifExistInSurCost = await SurgeryCost.findOne({surgeryId: surgeryId});
            if (!ifExistInSurCost) {
                await SurgeryCost.create({
                    surgeryId: surgeryId,
                    surgeryDate: surgeryDoc.surgeryDate,
                    type: surgeryDoc.type,
                }); 
            };
            console.log('search success');
            await updateEquipmentCost(surgeryDoc);
            await updateMaterialCost(surgeryDoc);
            await updateStuffCost(surgeryDoc);
            await updateOtherCost(surgeryDoc);
            await updateDrugCost(surgeryDoc);
        }
    } catch(e) {
        console.log(e);
    }
}

// 医生后输入手术数据，更新相应字段
app.post("/updatesurgery", async(req, res) => {
    try {
        const data = req.body;
        // console.log(data);
        const surgeryDoc = await Surgery.findOne({surgeryId: data.surgeryId});
        // console.log(surgeryDoc);

        // 如果手术存在，则添加字段更新
        if (surgeryDoc) {
            const ifUploaded = surgeryDoc.drugUsage.length === 0 ? false : true;

            // 该条手术没有上传过
            if (!ifUploaded) {
                await Surgery.updateOne({surgeryId: data.surgeryId}, {$set: data})
                    .then(() => {calCost(data.surgeryId);});
                res.status(200).json('更新成功');
                // 此时更新每条手术的数据
                  
            }
            
            // 这条id的手术已经上传过，不能重复上传
            else {
                res.json('该台手术编号的手术数据已经录入完毕，不能再次录入');

                //TODO: 测试用，过会儿删除
                // await Surgery.updateOne({surgeryId: data.surgeryId}, {$set: data});
                // calCost(data.surgeryId);
            }
        }
        // 手术不存在
        else {
            res.json('数据库中不存在这条id, 请护士先输入');
        }

    } catch(e) {
        res.status(422).json(e);
    }
})


// 前端发送请求接口，获取后端的单台手术数据
app.get('/getSurgeryCost', async (req, res) => {
    try {
        const allSurgeries = await SurgeryCost.find({});
        console.log(allSurgeries);
        res.status(200).json(allSurgeries);
    } catch (e) {
        res.status(500).json(e);
    }
})


const calSurgeryRoomCost = async() => {
    // SurgeryCost.aggregate
    const pipeline = [
        { $match: {}},
        { $group: { 
                _id: "$type",
                num: { $sum: 1 },
                stuffCost: { $sum: "$stuffCost"},
                materialCost: { $sum: "$materialCost"},
                drugCost: { $sum: "$drugCost"},
                otherCost: { $sum: "$otherCost"},
                equipmentCost: { $sum: "$equipmentCost"}
            }
        },

    ];
    const docs = [];
    const aggCursor = SurgeryCost.aggregate(pipeline);
    for await (const doc of aggCursor) {
        // console.log(doc);
        docs.push(doc);
        // console.log(doc);
    }
    return docs;


    // 更改成本数据库中的值
    // const ifExistRoomCost = await SurgeryRoom.find({});
    // if (ifExistRoomCost) {
    //     // await SurgeryRoom.updateMany(docs);
    // }
    // else {
    //     await SurgeryRoom.insertMany(docs);
    // }
    
}


// 获取手术室成本数据的接口
app.get('/getSurgeryRoomCost', async (req, res) =>{
    try {
        const datas = await calSurgeryRoomCost();
        res.status(200).json(datas);

    } catch (e) {
        res.status(500).json(e);
    }
})


const calCenterCost = async () => {
    const data = [
        {name: '专业仪器折旧', manage: 0, unused: 0, hundred: 0, thousand: 0, million: 0, dsa: 0},
        {name: '其他成本', manage: 0, unused: 0, hundred: 0, thousand: 0, million: 0, dsa: 0},
        {name: '合计作业中心成本', manage: 0, unused: 0, hundred: 0, thousand: 0, million: 0, dsa: 0}
    ];
    rawData = await calSurgeryRoomCost();

    const allOthers = await Other.find({});
    let management = 0;
    let unused = 0;
    for (const doc of allOthers) {
        management += doc.managecost;
        unused += doc.unusedcost;
    }
    data[1].manage = management;
    data[1].unused = unused;
    data[2].manage = data[0].manage + data[1].manage;
    data[2].manage = data[0].manage + data[1].manage;

    const updateCenterData = (doc, name) =>{
        data[0][name] = doc.equipmentCost;
        data[1][name] = doc.otherCost;
        data[2][name] = doc.equipmentCost + doc.otherCost;
    };

    for (const doc of rawData) {
        if (doc._id === '百级尘埃手术') {
            updateCenterData(doc, 'hundred');
        }
        else if (doc._id === '一类切口手术') {
            updateCenterData(doc, 'thousand');
        } 
        else if (doc._id === '二类切口手术') {
            updateCenterData(doc, 'million');
        }
        else if (doc._id === '血管类手术') {
            updateCenterData(doc, 'dsa');
        }
    }
    return data;
}

// 获取作业中心成本
app.get('/getCenterCost', async (req, res) => {
    try {
        const data = await calCenterCost();
        res.status(200).json(data);

    } catch (e) {
        res.status(500).json(e);
    }
})

app.listen(4000);