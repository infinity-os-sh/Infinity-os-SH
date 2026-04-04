// InventoryReportViewController.swift
// INFINITY OS · 库存心跳系统 v2.0
//
// 集成说明：
// 1. 在SFA导航或拜访详情页加入口：
//    let vc = InventoryReportViewController()
//    vc.storeName = "家乐福徐汇店"   // 可选：预填门店信息
//    vc.storeGrade = "S+"
//    navigationController?.pushViewController(vc, animated: true)
//
// 2. submitReport() 中替换为你们的API调用
// 3. HeartbeatCalculator.swift 无需修改

import UIKit

class InventoryReportViewController: UIViewController {

    // ── 外部传入（可选）──
    var storeName: String?
    var storeGrade: String?
    var storeId: String?

    // ── State ──
    private var selectedGrade: String = "S+" {
        didSet { calcAndDisplay() }
    }
    private var selectedSKU: String = "六月鲜极鲜500ml"
    private var lastResult: HeartbeatCalculator.Result?
    private var selectedPhoto: UIImage?

    // ── 数据 ──
    private let grades = ["S+", "S", "A", "B", "C", "D"]
    private let gradeDesc = ["旗舰·T=7天", "重点·T=7天", "重要·T=7天", "标准·T=14天", "普通·T=21天", "基础·T=30天"]
    private let skuList = ["六月鲜极鲜500ml", "六月鲜280ml", "味达美500ml", "禾然有机500ml", "葱伴侣200ml", "小康500ml"]
    private let perCaseOptions = [6, 12, 24]
    private var perCase: Int = 12

    // ── UI Elements ──
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()

    // 门店
    private let storeNameField = UITextField()
    private var gradeButtons: [UIButton] = []
    private var skuButtons: [UIButton] = []
    private let dailySalesField = UITextField()

    // 库存
    private let shelfField = UITextField()
    private let warehouseField = UITextField()
    private let warehouseBottlesLabel = UILabel()
    private let perCasePicker = UIPickerView()

    // 水位
    private let waterLevelLabel = UILabel()
    private let waterBadgeLabel = UILabel()
    private let waterSubLabel = UILabel()
    private let waterBar1 = UIView()
    private let waterBar2 = UIView()
    private let waterBar3 = UIView()
    private let formulaLabel = UILabel()
    private let adviceLabel = UILabel()

    // 异常标记
    private let flagASwitch = UISwitch()
    private let flagBSwitch = UISwitch()
    private let flagCSwitch = UISwitch()
    private let noteField = UITextView()

    // 照片
    private let photoButton = UIButton(type: .system)
    private let photoImageView = UIImageView()
    private let redoPhotoButton = UIButton(type: .system)

    // 底部提交
    private let submitBar = UIView()
    private let submitButton = UIButton(type: .system)
    private let shelfPreviewLabel = UILabel()
    private let warehousePreviewLabel = UILabel()
    private let totalPreviewLabel = UILabel()
    private let waterPreviewLabel = UILabel()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "库存上报"
        view.backgroundColor = UIColor(hex: "#07080D")
        navigationController?.navigationBar.barStyle = .black
        navigationController?.navigationBar.tintColor = UIColor(hex: "#F5A623")

        setupScrollView()
        buildUI()
        setupSubmitBar()

        // 预填信息
        if let name = storeName { storeNameField.text = name }
        if let grade = storeGrade { selectedGrade = grade }

        calcAndDisplay()
    }

    // MARK: - UI Setup

    private func setupScrollView() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        contentStack.axis = .vertical
        contentStack.spacing = 12
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -100),
            contentStack.topAnchor.constraint(equalTo: scrollView.topAnchor, constant: 16),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor, constant: 16),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor, constant: -16),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor, constant: -16),
            contentStack.widthAnchor.constraint(equalTo: scrollView.widthAnchor, constant: -32)
        ])
    }

    private func buildUI() {
        contentStack.addArrangedSubview(buildStoreSection())
        contentStack.addArrangedSubview(buildInventorySection())
        contentStack.addArrangedSubview(buildWaterLevelSection())
        contentStack.addArrangedSubview(buildPhotoSection())
        contentStack.addArrangedSubview(buildFlagSection())
    }

    private func buildStoreSection() -> UIView {
        let card = makeCard()
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])

        stack.addArrangedSubview(makeLabel("① 门店信息", color: "#F5A623", size: 13, bold: true))

        // 门店名称
        stack.addArrangedSubview(makeSmallLabel("门店名称"))
        styleTextField(storeNameField, placeholder: "搜索或输入门店名称…")
        storeNameField.addTarget(self, action: #selector(textChanged), for: .editingChanged)
        storeNameField.heightAnchor.constraint(equalToConstant: 44).isActive = true
        stack.addArrangedSubview(storeNameField)

        // 门店等级
        stack.addArrangedSubview(makeSmallLabel("门店等级"))
        let gradeGrid = makeGradeGrid()
        stack.addArrangedSubview(gradeGrid)

        // SKU
        stack.addArrangedSubview(makeSmallLabel("SKU品项"))
        let skuScroll = makeSKUScroll()
        stack.addArrangedSubview(skuScroll)

        // 日销量
        stack.addArrangedSubview(makeSmallLabel("本门店日销量（瓶/天）"))
        let dailyRow = makeStepperRow(field: dailySalesField, defaultVal: "5", step: 1)
        stack.addArrangedSubview(dailyRow)

        return card
    }

    private func buildInventorySection() -> UIView {
        let card = makeCard()
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])

        stack.addArrangedSubview(makeLabel("② 库存录入", color: "#F5A623", size: 13, bold: true))

        // 货架
        stack.addArrangedSubview(makeSmallLabel("📦 货架库存（瓶）· 品牌领地"))
        let shelfRow = makeStepperRow(field: shelfField, defaultVal: "0", step: 5)
        stack.addArrangedSubview(shelfRow)

        let div = UIView(); div.backgroundColor = UIColor(hex: "#1A2232"); div.heightAnchor.constraint(equalToConstant: 1).isActive = true
        stack.addArrangedSubview(div)

        // 仓库
        stack.addArrangedSubview(makeSmallLabel("🏪 仓库库存（箱）· 后备库存"))
        let warehouseRow = makeStepperRow(field: warehouseField, defaultVal: "0", step: 1)
        stack.addArrangedSubview(warehouseRow)

        // 每箱换算行
        let caseRow = UIStackView()
        caseRow.spacing = 8
        let caseLabel = makeSmallLabel("每箱 :")
        let caseButtons = makeCaseButtons()
        warehouseBottlesLabel.textColor = UIColor(hex: "#F5A623")
        warehouseBottlesLabel.font = .systemFont(ofSize: 13, weight: .bold)
        warehouseBottlesLabel.text = "= 0瓶"
        caseRow.addArrangedSubview(caseLabel)
        caseRow.addArrangedSubview(caseButtons)
        caseRow.addArrangedSubview(warehouseBottlesLabel)
        stack.addArrangedSubview(caseRow)

        return card
    }

    private func buildWaterLevelSection() -> UIView {
        let card = makeCard()
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])

        stack.addArrangedSubview(makeLabel("③ 心跳水位诊断", color: "#F5A623", size: 13, bold: true))

        // 水位大数字
        waterLevelLabel.font = .systemFont(ofSize: 48, weight: .bold)
        waterLevelLabel.text = "—"
        waterLevelLabel.textColor = UIColor(hex: "#3E4A60")

        waterBadgeLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        waterBadgeLabel.text = "等待录入"
        waterBadgeLabel.textColor = UIColor(hex: "#4A5468")

        let topRow = UIStackView(arrangedSubviews: [waterLevelLabel, UIView(), waterBadgeLabel])
        topRow.alignment = .center
        stack.addArrangedSubview(topRow)

        waterSubLabel.font = .systemFont(ofSize: 12)
        waterSubLabel.textColor = UIColor(hex: "#4A5468")
        waterSubLabel.text = "请填写库存数量"
        stack.addArrangedSubview(waterSubLabel)

        // 三格水位条
        let barStack = UIStackView(arrangedSubviews: [waterBar1, waterBar2, waterBar3])
        barStack.spacing = 4
        barStack.distribution = .fillEqually
        barStack.heightAnchor.constraint(equalToConstant: 8).isActive = true
        [waterBar1, waterBar2, waterBar3].forEach {
            $0.backgroundColor = UIColor(hex: "#1A2232")
            $0.layer.cornerRadius = 4
        }
        stack.addArrangedSubview(barStack)

        // 公式展示
        formulaLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        formulaLabel.textColor = UIColor(hex: "#4A5468")
        formulaLabel.numberOfLines = 0
        formulaLabel.text = "录入数据后显示计算过程"
        formulaLabel.backgroundColor = UIColor(hex: "#0F1219")
        formulaLabel.layer.cornerRadius = 8
        formulaLabel.clipsToBounds = true
        // 添加内边距
        let formulaContainer = addPadding(to: formulaLabel, padding: 12)
        stack.addArrangedSubview(formulaContainer)

        // 补货建议
        adviceLabel.font = .systemFont(ofSize: 13)
        adviceLabel.textColor = UIColor(hex: "#8A95AA")
        adviceLabel.numberOfLines = 0
        adviceLabel.isHidden = true
        stack.addArrangedSubview(adviceLabel)

        return card
    }

    private func buildPhotoSection() -> UIView {
        let card = makeCard()
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])

        stack.addArrangedSubview(makeLabel("④ 拍照记录", color: "#F5A623", size: 13, bold: true))

        photoButton.setTitle("📷  拍摄货架照片", for: .normal)
        photoButton.backgroundColor = UIColor(hex: "#0F1219")
        photoButton.layer.cornerRadius = 12
        photoButton.heightAnchor.constraint(equalToConstant: 80).isActive = true
        photoButton.addTarget(self, action: #selector(takePhoto), for: .touchUpInside)
        stack.addArrangedSubview(photoButton)

        photoImageView.contentMode = .scaleAspectFill
        photoImageView.clipsToBounds = true
        photoImageView.layer.cornerRadius = 10
        photoImageView.isHidden = true
        photoImageView.heightAnchor.constraint(equalToConstant: 180).isActive = true
        stack.addArrangedSubview(photoImageView)

        redoPhotoButton.setTitle("重拍", for: .normal)
        redoPhotoButton.isHidden = true
        redoPhotoButton.addTarget(self, action: #selector(redoPhoto), for: .touchUpInside)
        stack.addArrangedSubview(redoPhotoButton)

        return card
    }

    private func buildFlagSection() -> UIView {
        let card = makeCard()
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16)
        ])

        stack.addArrangedSubview(makeLabel("⑤ 异常标记（可选）", color: "#F5A623", size: 13, bold: true))

        flagASwitch.onTintColor = UIColor(hex: "#FF5F5F")
        flagBSwitch.onTintColor = UIColor(hex: "#F5A623")
        flagCSwitch.onTintColor = UIColor(hex: "#60A5FA")

        stack.addArrangedSubview(makeSwitchRow(sw: flagASwitch, text: "库存明显偏高，怀疑压货（A类失真）"))
        stack.addArrangedSubview(makeSwitchRow(sw: flagBSwitch, text: "促销期间数据，非正常销售（B类失真）"))
        stack.addArrangedSubview(makeSwitchRow(sw: flagCSwitch, text: "发现低价/窜货商品（C类失真）"))

        stack.addArrangedSubview(makeSmallLabel("备注（可选）"))
        noteField.backgroundColor = UIColor(hex: "#0F1219")
        noteField.textColor = UIColor(hex: "#E2E8F4")
        noteField.font = .systemFont(ofSize: 13)
        noteField.layer.cornerRadius = 8
        noteField.heightAnchor.constraint(equalToConstant: 80).isActive = true
        stack.addArrangedSubview(noteField)

        return card
    }

    private func setupSubmitBar() {
        submitBar.backgroundColor = UIColor(hex: "#07080D")
        submitBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(submitBar)
        NSLayoutConstraint.activate([
            submitBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            submitBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            submitBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            submitBar.heightAnchor.constraint(equalToConstant: 100)
        ])

        submitButton.setTitle("提交上报", for: .normal)
        submitButton.backgroundColor = UIColor(hex: "#F5A623")
        submitButton.setTitleColor(.black, for: .normal)
        submitButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        submitButton.layer.cornerRadius = 13
        submitButton.translatesAutoresizingMaskIntoConstraints = false
        submitButton.addTarget(self, action: #selector(submitReport), for: .touchUpInside)
        submitBar.addSubview(submitButton)
        NSLayoutConstraint.activate([
            submitButton.leadingAnchor.constraint(equalTo: submitBar.leadingAnchor, constant: 16),
            submitButton.trailingAnchor.constraint(equalTo: submitBar.trailingAnchor, constant: -16),
            submitButton.bottomAnchor.constraint(equalTo: submitBar.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            submitButton.heightAnchor.constraint(equalToConstant: 50)
        ])
    }

    // MARK: - Core Logic

    @objc private func textChanged() { calcAndDisplay() }

    private func calcAndDisplay() {
        guard
            let dailySalesStr = dailySalesField.text, let dailySales = Double(dailySalesStr), dailySales > 0,
            let shelfStr = shelfField.text, let shelf = Int(shelfStr),
            let warehouseStr = warehouseField.text, let warehouse = Int(warehouseStr)
        else { showEmptyState(); return }

        warehouseBottlesLabel.text = "= \(warehouse * perCase)瓶"

        if shelf == 0 && warehouse == 0 { showEmptyState(); return }

        let result = HeartbeatCalculator.calculate(
            dailySalesRate: dailySales,
            grade: selectedGrade,
            shelfQty: shelf,
            warehouseQty: warehouse,
            bottlesPerCase: perCase
        )
        lastResult = result
        updateWaterUI(result: result)
    }

    private func updateWaterUI(result: HeartbeatCalculator.Result) {
        let colorHex = result.status.color
        let color = UIColor(hex: colorHex)

        waterLevelLabel.text = String(format: "%.2f", result.waterLevel)
        waterLevelLabel.textColor = color
        waterBadgeLabel.text = result.status.badgeText
        waterBadgeLabel.textColor = color
        waterSubLabel.text = String(format: "总库存%d瓶 ÷ a值%.0f瓶 = %.2fa",
            result.totalBottles, result.heartbeatUnit, result.waterLevel)
        formulaLabel.text = result.formulaDetail
        adviceLabel.text = result.advice
        adviceLabel.isHidden = false

        // 三格水位条动画
        let level = result.waterLevel
        UIView.animate(withDuration: 0.3) {
            let pct1 = min(1.0, max(0.0, min(level, 1.0)))
            let pct2 = min(1.0, max(0.0, min(level, 2.0) - 1.0))
            let pct3 = min(1.0, max(0.0, min(level, 3.0) - 2.0))
            self.waterBar1.backgroundColor = level < 1
                ? UIColor(hex: "#FF5F5F")?.withAlphaComponent(CGFloat(pct1))
                : UIColor(hex: "#4ADE80")
            self.waterBar2.backgroundColor = level < 2
                ? UIColor(hex: "#F5A623")?.withAlphaComponent(CGFloat(pct2))
                : UIColor(hex: "#4ADE80")
            self.waterBar3.backgroundColor = UIColor(hex: "#4ADE80")?.withAlphaComponent(CGFloat(pct3))
        }
    }

    private func showEmptyState() {
        waterLevelLabel.text = "—"
        waterLevelLabel.textColor = UIColor(hex: "#3E4A60")
        waterBadgeLabel.text = "等待录入"
        waterSubLabel.text = "请填写库存数量"
        formulaLabel.text = "录入数据后显示计算过程"
        adviceLabel.isHidden = true
        lastResult = nil
    }

    // MARK: - Actions

    @objc private func submitReport() {
        guard let name = storeNameField.text, !name.isEmpty else {
            showAlert("请填写门店名称"); return
        }
        guard let result = lastResult else {
            showAlert("请填写库存数量"); return
        }

        // ══════════════════════════════════════════════
        // TODO: 替换为你们SFA的API调用
        //
        // let report = InventoryReport(
        //     storeName: name,
        //     storeGrade: selectedGrade,
        //     sku: selectedSKU,
        //     shelfBottles: result.shelfBottles,
        //     warehouseBottles: result.warehouseBottles,
        //     totalBottles: result.totalBottles,
        //     heartbeatUnit: result.heartbeatUnit,
        //     waterLevel: result.waterLevel,
        //     waterStatus: result.status.badgeText,
        //     flagA: flagASwitch.isOn,
        //     flagB: flagBSwitch.isOn,
        //     flagC: flagCSwitch.isOn,
        //     note: noteField.text ?? "",
        //     reportTime: Date()
        // )
        // APIClient.shared.submitInventoryReport(report) { success, error in
        //     if success { self.showSuccess() } else { self.showAlert(error) }
        // }
        // ══════════════════════════════════════════════

        // 临时：本地成功提示
        let msg = String(format: "✅ 上报成功\n%@  %@\n水位 %.2fa · %@",
            name, selectedGrade, result.waterLevel, result.status.badgeText)
        showAlert(msg, title: "上报成功") { self.resetForm() }
    }

    @objc private func takePhoto() {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = self
        present(picker, animated: true)
    }

    @objc private func redoPhoto() {
        photoImageView.isHidden = true
        redoPhotoButton.isHidden = true
        photoButton.isHidden = false
        selectedPhoto = nil
    }

    private func resetForm() {
        storeNameField.text = ""
        dailySalesField.text = "5"
        shelfField.text = "0"
        warehouseField.text = "0"
        noteField.text = ""
        flagASwitch.isOn = false
        flagBSwitch.isOn = false
        flagCSwitch.isOn = false
        redoPhoto()
        showEmptyState()
        scrollView.setContentOffset(.zero, animated: true)
    }

    // MARK: - UI Helpers

    private func makeCard() -> UIView {
        let v = UIView()
        v.backgroundColor = UIColor(hex: "#141820")
        v.layer.cornerRadius = 16
        v.layer.masksToBounds = true
        return v
    }

    private func makeLabel(_ text: String, color: String, size: CGFloat, bold: Bool) -> UILabel {
        let l = UILabel()
        l.text = text
        l.textColor = UIColor(hex: color)
        l.font = bold ? .systemFont(ofSize: size, weight: .bold) : .systemFont(ofSize: size)
        return l
    }

    private func makeSmallLabel(_ text: String) -> UILabel {
        makeLabel(text, color: "#4A5468", size: 11, bold: false)
    }

    private func styleTextField(_ tf: UITextField, placeholder: String) {
        tf.backgroundColor = UIColor(hex: "#0F1219")
        tf.textColor = UIColor(hex: "#E2E8F4")
        tf.font = .systemFont(ofSize: 14)
        tf.layer.cornerRadius = 10
        tf.layer.borderWidth = 1
        tf.layer.borderColor = UIColor(hex: "#1A2232")?.cgColor
        tf.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: UIColor(hex: "#3E4A60") as Any])
        let pad = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        tf.leftView = pad; tf.leftViewMode = .always
        tf.rightView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        tf.rightViewMode = .always
        tf.addTarget(self, action: #selector(textChanged), for: .editingChanged)
    }

    private func makeStepperRow(field: UITextField, defaultVal: String, step: Int) -> UIStackView {
        styleTextField(field, placeholder: "")
        field.text = defaultVal
        field.textAlignment = .center
        field.font = .systemFont(ofSize: 26, weight: .bold)
        field.keyboardType = .numberPad
        field.heightAnchor.constraint(equalToConstant: 52).isActive = true

        let minus = makeStepButton("-", step: -step, field: field)
        let plus = makeStepButton("+", step: step, field: field)

        let row = UIStackView(arrangedSubviews: [minus, field, plus])
        row.spacing = 8
        return row
    }

    private func makeStepButton(_ title: String, step: Int, field: UITextField) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 22, weight: .medium)
        btn.backgroundColor = UIColor(hex: "#1A2232")
        btn.layer.cornerRadius = 10
        btn.widthAnchor.constraint(equalToConstant: 52).isActive = true
        btn.heightAnchor.constraint(equalToConstant: 52).isActive = true
        btn.setTitleColor(step > 0 ? UIColor(hex: "#F5A623") : UIColor(hex: "#8A95AA"), for: .normal)
        let s = step
        btn.addAction(UIAction { _ in
            let current = Int(field.text ?? "0") ?? 0
            field.text = String(max(0, current + s))
            self.calcAndDisplay()
        }, for: .touchUpInside)
        return btn
    }

    private func makeGradeGrid() -> UIView {
        let grid = UIView()
        for (i, grade) in grades.enumerated() {
            let btn = UIButton(type: .system)
            btn.setTitle("\(grade)\n\(gradeDesc[i])", for: .normal)
            btn.titleLabel?.numberOfLines = 2
            btn.titleLabel?.textAlignment = .center
            btn.titleLabel?.font = .systemFont(ofSize: 11)
            btn.layer.cornerRadius = 10
            btn.layer.borderWidth = 1
            btn.tag = i
            gradeButtons.append(btn)
            updateGradeButtonStyle(btn, selected: grade == selectedGrade)
            btn.addAction(UIAction { _ in
                self.selectedGrade = grade
                self.gradeButtons.enumerated().forEach { j, b in
                    self.updateGradeButtonStyle(b, selected: self.grades[j] == self.selectedGrade)
                }
            }, for: .touchUpInside)
        }
        // 两行三列布局
        grid.translatesAutoresizingMaskIntoConstraints = false
        let row1 = UIStackView(arrangedSubviews: Array(gradeButtons.prefix(3)))
        row1.distribution = .fillEqually; row1.spacing = 6
        let row2 = UIStackView(arrangedSubviews: Array(gradeButtons.suffix(3)))
        row2.distribution = .fillEqually; row2.spacing = 6
        let col = UIStackView(arrangedSubviews: [row1, row2])
        col.axis = .vertical; col.spacing = 6
        col.translatesAutoresizingMaskIntoConstraints = false
        grid.addSubview(col)
        [row1, row2].forEach { $0.arrangedSubviews.forEach { $0.heightAnchor.constraint(equalToConstant: 60).isActive = true }}
        NSLayoutConstraint.activate([
            col.topAnchor.constraint(equalTo: grid.topAnchor),
            col.bottomAnchor.constraint(equalTo: grid.bottomAnchor),
            col.leadingAnchor.constraint(equalTo: grid.leadingAnchor),
            col.trailingAnchor.constraint(equalTo: grid.trailingAnchor)
        ])
        return grid
    }

    private func updateGradeButtonStyle(_ btn: UIButton, selected: Bool) {
        btn.backgroundColor = selected ? UIColor(hex: "#1A4A1A") : UIColor(hex: "#0F1219")
        btn.setTitleColor(selected ? UIColor(hex: "#4ADE80") : UIColor(hex: "#8A95AA"), for: .normal)
        btn.layer.borderColor = (selected ? UIColor(hex: "#2A6A2A") : UIColor(hex: "#1A2232"))?.cgColor
    }

    private func makeSKUScroll() -> UIScrollView {
        let sv = UIScrollView(); sv.showsHorizontalScrollIndicator = false
        let stack = UIStackView(); stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        sv.addSubview(stack)
        sv.heightAnchor.constraint(equalToConstant: 36).isActive = true
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: sv.topAnchor),
            stack.leadingAnchor.constraint(equalTo: sv.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: sv.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: sv.bottomAnchor),
            stack.heightAnchor.constraint(equalTo: sv.heightAnchor)
        ])
        for sku in skuList {
            let btn = UIButton(type: .system)
            btn.setTitle(sku, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 12)
            btn.layer.cornerRadius = 14; btn.layer.borderWidth = 1
            btn.contentEdgeInsets = UIEdgeInsets(top: 4, left: 12, bottom: 4, right: 12)
            skuButtons.append(btn)
            updateSKUButtonStyle(btn, selected: sku == selectedSKU)
            let s = sku
            btn.addAction(UIAction { _ in
                self.selectedSKU = s
                self.skuButtons.enumerated().forEach { i, b in
                    self.updateSKUButtonStyle(b, selected: self.skuList[i] == self.selectedSKU)
                }
            }, for: .touchUpInside)
            stack.addArrangedSubview(btn)
        }
        return sv
    }

    private func updateSKUButtonStyle(_ btn: UIButton, selected: Bool) {
        btn.backgroundColor = selected ? UIColor(hex: "#1A1500") : UIColor(hex: "#0F1219")
        btn.setTitleColor(selected ? UIColor(hex: "#F5A623") : UIColor(hex: "#7A8599"), for: .normal)
        btn.layer.borderColor = (selected ? UIColor(hex: "#F5A623") : UIColor(hex: "#1A2232"))?.cgColor
    }

    private func makeCaseButtons() -> UIStackView {
        let stack = UIStackView()
        stack.spacing = 4
        for c in perCaseOptions {
            let btn = UIButton(type: .system)
            btn.setTitle("\(c)瓶", for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 11)
            btn.layer.cornerRadius = 8; btn.layer.borderWidth = 1
            btn.contentEdgeInsets = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
            let selected = c == perCase
            btn.backgroundColor = selected ? UIColor(hex: "#1A1500") : UIColor(hex: "#0F1219")
            btn.setTitleColor(selected ? UIColor(hex: "#F5A623") : UIColor(hex: "#7A8599"), for: .normal)
            btn.layer.borderColor = (selected ? UIColor(hex: "#F5A623") : UIColor(hex: "#1A2232"))?.cgColor
            let cc = c
            btn.addAction(UIAction { _ in
                self.perCase = cc
                self.calcAndDisplay()
            }, for: .touchUpInside)
            stack.addArrangedSubview(btn)
        }
        return stack
    }

    private func makeSwitchRow(sw: UISwitch, text: String) -> UIStackView {
        let label = UILabel()
        label.text = text
        label.textColor = UIColor(hex: "#8A95AA")
        label.font = .systemFont(ofSize: 12)
        label.numberOfLines = 0
        let row = UIStackView(arrangedSubviews: [label, sw])
        row.alignment = .center
        row.spacing = 8
        return row
    }

    private func addPadding(to view: UIView, padding: CGFloat) -> UIView {
        let container = UIView()
        container.addSubview(view)
        view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: container.topAnchor, constant: padding),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: padding),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -padding),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -padding)
        ])
        return container
    }

    private func showAlert(_ msg: String, title: String = "提示", completion: (() -> Void)? = nil) {
        let alert = UIAlertController(title: title, message: msg, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in completion?() })
        present(alert, animated: true)
    }
}

// MARK: - UIImagePickerControllerDelegate
extension InventoryReportViewController: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    func imagePickerController(_ picker: UIImagePickerController,
                               didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        if let image = info[.originalImage] as? UIImage {
            selectedPhoto = image
            photoImageView.image = image
            photoImageView.isHidden = false
            redoPhotoButton.isHidden = false
            photoButton.isHidden = true
        }
    }
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
}

// MARK: - UIColor Extension
extension UIColor {
    convenience init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let val = UInt64(h, radix: 16) else { return nil }
        self.init(red: CGFloat((val >> 16) & 0xFF) / 255,
                  green: CGFloat((val >> 8) & 0xFF) / 255,
                  blue: CGFloat(val & 0xFF) / 255, alpha: 1.0)
    }
}
