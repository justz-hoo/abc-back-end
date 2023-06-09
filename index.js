const express = require("express");
const app = express();
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const Surgery = require('./models/surgery');
const Equipment = require('./models/equipment');
const SurgeryCost = require('./models/surgerycost');
const Material = require('./models/material');
const Stuff = require('./models/salary');
const Drug = require('./models/drug');
const Other = require('./models/other');

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
}));
app.use(express.json());

console.log(process.env.MONGO_URL);
mongoose.connect(process.env.MONGO_URL);


// 测试用
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
            res.status(200).json('数据库中存在该手术编号，请输入新的手术数据');
        }
        // 如果数据库中不存在本次手术手术id，则新建手术记录
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
const updateEquipmentCost = async (curSurgery, ifAdd) => {
    // console.log(curSurgery.equipmentUsage);
    const equipments = curSurgery.equipmentUsage;
    
    // equipments.forEach(async (equip, index) => {
    //     const curEquip = await Equipment.findOne({name: equip.name});
    //     if (ifAdd) {
    //         const newUsageTime = curEquip.usageTime + equip.usage;
    //         await Equipment.updateOne({name: equip.name}, {$set: {usageTime: newUsageTime}});
    //     }
    //     else {
    //         const newUsageTime = curEquip.usageTime - equip.usage >= 0 ? curEquip.usageTime - equip.usage: 0;
    //         await Equipment.updateOne({name: equip.name}, {$set: {usageTime: newUsageTime}});
    //         console.log('newUsageTime', newUsageTime);
    //     }
        
    // });

    // 1）更新设备总用时
    for (equip of equipments) {
        const curEquip = await Equipment.findOne({name: equip.name});
        if (ifAdd) {
            const newUsageTime = curEquip.usageTime + equip.usage;
            await Equipment.updateOne({name: equip.name}, {$set: {usageTime: newUsageTime}});
        }
        else {
            const newUsageTime = curEquip.usageTime - equip.usage >= 0 ? curEquip.usageTime - equip.usage: 0;
            await Equipment.updateOne({name: equip.name}, {$set: {usageTime: newUsageTime}});
            console.log('newUsageTime', newUsageTime);
        }
    }

    // 更新每一台手术的设备耗材
    // 这里异步等待一下，等待前面数据库CRUD操作完成，否则会有bug
    setTimeout(async() => {
        await updateSingleSurgery();
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
    console.log('成本：', sumCost);
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

// 1.0 计算单台手术成本
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
            await updateEquipmentCost(surgeryDoc, ifAdd=true);
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
        const surgeryDoc = await Surgery.findOne({surgeryId: data.surgeryId});

        // 如果手术存在，则添加字段更新
        if (surgeryDoc) {
            const ifUploaded = surgeryDoc.drugUsage.length === 0 ? false : true;

            // 该条手术没有上传过
            if (!ifUploaded) {
                await Surgery.updateOne({surgeryId: data.surgeryId}, {$set: data})
                    .then(() => {calCost(data.surgeryId);});
                res.status(200).json('更新成功');   
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


// 获取单台手术数据
app.get('/getSurgeryCost', async (req, res) => {
    try {
        const allSurgeries = await SurgeryCost.find({});
        res.status(200).json(allSurgeries);
    } catch (e) {
        res.status(500).json(e);
    }
})

// 2.0 计算手术室成本
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
}


// 获取手术室成本数据的接口
app.get('/getSurgeryRoomCost', async (req, res) =>{
    try {
        const datas = await calSurgeryRoomCost();
        for (let i = 0; i < datas.length; i++) {
            datas[i].centerCost = datas[i].equipmentCost + datas[i].stuffCost + datas[i].otherCost;
            datas[i].sumMaterial = datas[i].drugCost + datas[i].materialCost;
            datas[i].sumCost = datas[i].centerCost + datas[i].sumMaterial;
            datas[i].avgCost = datas[i].sumCost / datas[i].num;
        }
        res.status(200).json(datas);

    } catch (e) {
        res.status(500).json(e);
    }
})


// 3.0 计算作业中心成本
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
    data[2].unused = data[0].unused + data[1].unused;

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

// 4.0 计算科室成本
const calDepartmentCost = async() => {
    const rawData = await calSurgeryRoomCost();
    console.log(rawData);
    const data = [{name: "科室成本", cost0: 0, cost1: 0, cost2: 0, cost3: 0},];
    for (const doc of rawData) {
        const sumCost = doc.stuffCost + doc.materialCost + doc.drugCost + doc.otherCost + doc.equipmentCost;
        const name = doc._id;
        if (name === '一类切口手术') data[0].cost1 = sumCost;
        else if (name === '二类切口手术') data[0].cost2 = sumCost;
        else if (name === '血管类手术') data[0].cost3 = sumCost;
        else if (name === '百级尘埃手术') data[0].cost0 = sumCost;
    }
    return data;
}

// 获取科室成本
app.get('/getDepartment', async (req, res) => {
    try {
        const data = await calDepartmentCost();
        res.status(200).json(data);
    } catch(e) {
        res.status(500).json(e);
    }
})


// 更新人员工资数据输入数据
app.post('/updateSalary', async (req, res) => {
    try {
        const data = req.body;
        for (item of data) {
            await Stuff.updateOne({type: item.type}, {$set: {
                num: item.num,
                workday: item.workday,
                worktimeperday: item.worktimeperday,
                theorytime: item.theorytime,
                validtime: item.validtime,
                sumsalary: item.sumsalary
            }});
            console.log(item);
        }
        // 更新人员单位成本
        await updateAllStuffUnitCost();
        res.status(200).json('success');
    } catch (e) {
        res.status(500).json(e);
    }
})

// 更新设备设备数据
app.post('/updateEquipment', async(req, res) => {
    try {
        const datas = req.body;
        console.log(datas);
        // 清除数据库中原有数据
        await Equipment.deleteMany({});
        
        for (item of datas) {
            await Equipment.create({name: item.name, cost: item.cost, usageTime: 0});
            console.log(item);
        }
        res.status(200).json('success equipment');
    } catch (e) {
        res.status(500).json(e);
    }
})

// 更新其他数据
app.post('/updateOther', async (req, res) => {
    try {
        const datas = req.body;
        console.log(datas);

        // 清空其他数据库
        await Other.deleteMany({});
        // 添加其他数据
        for (const item of datas) {
            await Other.create({name: item.name, managecost: item.managecost, unusedcost: item.unusedcost})
        }
        res.status(200).json('success');
    } catch(e) {
        res.status(500).json(e);
    }

})

// 初始化系统
app.post('/initializesys', async (req, res) => {
    try {
        await Surgery.deleteMany({});
        await SurgeryCost.deleteMany({});
        await Equipment.deleteMany({});
        await Other.deleteMany({});
        await Stuff.updateMany({}, {$set : {
            num: 0,
            workday: 0,
            worktimeperday: 0,
            theorytime: 0,
            validtime: 0,
            sumsalary: 0,
            costPerMin: 0
        }})
        res.status(200).json('success');
    } catch (e) {
        res.status(500).json(e);
    }
})


// 获取手术数据列表
app.get('/getallsurgeries', async (req, res) => {
    try {
        const surgeryData = await Surgery.find({});
        console.log(surgeryData);
        res.status(200).json(surgeryData);

    } catch(e) {
        res.status(500).json(e);
    }
})

// 获取财务输入的Other数据
app.get('/getallothers', async (req, res) => {
    try {
        const otherData = await Other.find({});
        res.status(200).json(otherData);
        console.log(otherData);
    } catch (e) {
        res.status(500).json(e);
    }
})

// 获取财务输入的人员工资
app.get('/getallstuffsalarires', async(req, res) => {
    try {
        const stuffData = await Stuff.find({});
        res.status(200).json(stuffData);
    } catch(e) {
        res.status(500).json(e);
    }
})

// 获取财务输入的专业仪器成本
app.get('/getallequipments', async(req, res) => {
    try {
        const equipData = await Equipment.find({});
        res.status(200).json(equipData);
    } catch(e) {
        res.status(500).json(e);
    }
})


// 删除手术记录
app.delete('/deleteSurgeryById', async(req, res) => {
    try {
        const surgeryId = req.body.id;
        const surgeryDoc = await Surgery.findOne({surgeryId: surgeryId});
        
        // 更新设备使用时间
        if (surgeryDoc) {
            await updateEquipmentCost(surgeryDoc, ifAdd=false);
        }
        //删除这条手术记录
        await Surgery.deleteOne({surgeryId: surgeryId});
        await SurgeryCost.deleteOne({surgeryId: surgeryId});

        res.status(200).json('success');

    } catch(e) {
        res.status(500).json(e);
    }
})


// 更新麻醉材料单价
app.post('/updateDrugUnit', async(req, res) => {
    try {
        const doc = req.body;

        // 更新麻醉材料单价
        await Drug.updateOne({name: doc.name}, {$set: {unitprice: doc.unitprice}});

        // 更新每一台手术的麻醉材料成本
        const allSurgeries = await Surgery.find({});
        for (const surgeryDoc of allSurgeries) {
            await updateDrugCost(surgeryDoc);
        }

        res.status(200).json('success');
    } catch (e) {
        res.status(500).json(e);
    }
})

// 获取所有麻醉材料单价
app.get('/getalldrugs', async(req, res) => {
    try {
        const datas = await Drug.find({});
        res.status(200).json(datas);
    } catch (e) {
        res.status(500).json(e);
    }
})


// 更新不收费卫生材料单价
app.post('/updateMaterialUnit', async(req, res) => {
    try {
        const doc = req.body;

        // 更新不收费卫生材料单价
        await Material.updateOne({name: doc.name}, {$set: {unitprice: doc.unitprice}});

        // 更新每一台手术的不收费卫生材料成本
        const allSurgeries = await Surgery.find({});
        for (const surgeryDoc of allSurgeries) {
            await updateMaterialCost(surgeryDoc);
        }
        res.status(200).json('success');
    } catch (e) {
        res.status(500).json(e);
    }
})


// 获取所有不收费卫生材料单价
app.get('/getallmaterials', async(req, res) => {
    try {
        const datas = await Material.find({});
        res.status(200).json(datas);
    } catch (e) {
        res.status(500).json(e);
    }
})


// 监听本机4000端口，即后端运行在4000端口上
// [注]：前端运行在3000端口上
// 前后端运行在不同的端口上，进行数据传输，因此要解决跨域问题
// 使用cors解决跨域访问，见index.js 16-20行
app.listen(4000);