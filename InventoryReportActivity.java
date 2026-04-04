package com.xinhe.sfa.inventory;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.MenuItem;
import android.view.View;
import android.widget.*;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.xinhe.sfa.R;
// TODO: 替换为你们SFA现有的网络库
// import com.xinhe.sfa.network.ApiClient;
// TODO: 替换为你们SFA现有的用户Model
// import com.xinhe.sfa.model.UserSession;
// TODO: 替换为你们SFA现有的门店Model
// import com.xinhe.sfa.model.Store;

/**
 * 库存上报页面
 * INFINITY OS · 库存心跳系统 v2.0
 *
 * 集成说明：
 * 1. 在SFA主菜单或拜访页面添加入口按钮，startActivity(new Intent(this, InventoryReportActivity.class))
 * 2. 可通过Intent传入门店信息：intent.putExtra("storeId", storeId)
 * 3. 提交方法 submitReport() 中替换为你们的API调用
 * 4. HeartbeatCalculator.java 无需修改，直接使用
 */
public class InventoryReportActivity extends AppCompatActivity {

    // ── Views ──
    private AutoCompleteTextView etStoreName;
    private EditText etDailySales, etShelfQty, etWarehouseQty, etNote;
    private TextView tvWaterLevel, tvWaterBadge, tvWaterSub, tvFormula, tvAdvice, tvWarehouseBottles;
    private Spinner spinnerPerCase;
    private ImageView ivPhoto;
    private Button btnTakePhoto, btnRedoPhoto, btnSubmit;
    private CheckBox cbFlagA, cbFlagB, cbFlagC;

    // ── State ──
    private String selectedGrade = "S+";
    private String selectedSKU = "六月鲜极鲜500ml";
    private Uri photoUri = null;
    private HeartbeatCalculator.Result lastResult = null;

    // 每箱瓶数选项
    private final int[] PER_CASE_OPTIONS = {6, 12, 24};
    private final String[] PER_CASE_LABELS = {"6瓶/箱", "12瓶/箱", "24瓶/箱"};

    // SKU列表 - TODO: 替换为从服务器获取
    private final String[] SKU_LIST = {
        "六月鲜极鲜500ml", "六月鲜280ml", "味达美500ml",
        "禾然有机500ml", "葱伴侣200ml", "小康500ml"
    };

    private static final int REQUEST_CAMERA = 101;
    private static final int REQUEST_CAMERA_PERMISSION = 102;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory_report);

        // 设置标题
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle("库存上报");
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setBackgroundDrawable(
                new android.graphics.drawable.ColorDrawable(Color.parseColor("#07080D")));
        }

        initViews();
        setupGradeButtons();
        setupSKUChips();
        setupSpinner();
        setupInputListeners();
        setupPhotoButton();
        setupSubmitButton();

        // 如果从外部传入门店信息，自动填充
        handleIntentData();

        calcAndDisplay();
    }

    private void initViews() {
        etStoreName = findViewById(R.id.etStoreName);
        etDailySales = findViewById(R.id.etDailySales);
        etShelfQty = findViewById(R.id.etShelfQty);
        etWarehouseQty = findViewById(R.id.etWarehouseQty);
        etNote = findViewById(R.id.etNote);
        tvWaterLevel = findViewById(R.id.tvWaterLevel);
        tvWaterBadge = findViewById(R.id.tvWaterBadge);
        tvWaterSub = findViewById(R.id.tvWaterSub);
        tvFormula = findViewById(R.id.tvFormula);
        tvAdvice = findViewById(R.id.tvAdvice);
        tvWarehouseBottles = findViewById(R.id.tvWarehouseBottles);
        spinnerPerCase = findViewById(R.id.spinnerPerCase);
        ivPhoto = findViewById(R.id.ivPhoto);
        btnTakePhoto = findViewById(R.id.btnTakePhoto);
        btnRedoPhoto = findViewById(R.id.btnRedoPhoto);
        cbFlagA = findViewById(R.id.cbFlagA);
        cbFlagB = findViewById(R.id.cbFlagB);
        cbFlagC = findViewById(R.id.cbFlagC);

        // 底部提交按钮 - 悬浮固定
        btnSubmit = new Button(this);
        btnSubmit.setText("提交上报");
        // TODO: 加入底部固定布局
    }

    private void setupGradeButtons() {
        int[] btnIds = {
            R.id.btnGradeSPlus, R.id.btnGradeS, R.id.btnGradeA,
            R.id.btnGradeB, R.id.btnGradeC, R.id.btnGradeD
        };
        String[] grades = {"S+", "S", "A", "B", "C", "D"};

        for (int i = 0; i < btnIds.length; i++) {
            final String grade = grades[i];
            Button btn = findViewById(btnIds[i]);
            btn.setOnClickListener(v -> {
                selectedGrade = grade;
                updateGradeButtonStyles(btnIds, grades);
                calcAndDisplay();
            });
        }
    }

    private void updateGradeButtonStyles(int[] btnIds, String[] grades) {
        for (int i = 0; i < btnIds.length; i++) {
            Button btn = findViewById(btnIds[i]);
            if (grades[i].equals(selectedGrade)) {
                btn.setBackgroundTintList(
                    android.content.res.ColorStateList.valueOf(Color.parseColor("#1A4A1A")));
                btn.setTextColor(Color.parseColor("#4ADE80"));
            } else {
                btn.setBackgroundTintList(
                    android.content.res.ColorStateList.valueOf(Color.parseColor("#111420")));
                btn.setTextColor(Color.parseColor("#8A95AA"));
            }
        }
    }

    private void setupSKUChips() {
        LinearLayout container = findViewById(R.id.skuContainer);
        for (String sku : SKU_LIST) {
            Button chip = new Button(this);
            chip.setText(sku);
            chip.setTextSize(11f);
            chip.setPadding(24, 12, 24, 12);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMarginEnd(8);
            chip.setLayoutParams(lp);
            updateChipStyle(chip, sku.equals(selectedSKU));
            chip.setOnClickListener(v -> {
                selectedSKU = sku;
                for (int i = 0; i < container.getChildCount(); i++) {
                    View child = container.getChildAt(i);
                    if (child instanceof Button) {
                        updateChipStyle((Button) child,
                            ((Button) child).getText().toString().equals(selectedSKU));
                    }
                }
            });
            container.addView(chip);
        }
    }

    private void updateChipStyle(Button chip, boolean selected) {
        if (selected) {
            chip.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(Color.parseColor("#1A1500")));
            chip.setTextColor(Color.parseColor("#F5A623"));
        } else {
            chip.setBackgroundTintList(
                android.content.res.ColorStateList.valueOf(Color.parseColor("#111420")));
            chip.setTextColor(Color.parseColor("#7A8599"));
        }
    }

    private void setupSpinner() {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, PER_CASE_LABELS);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerPerCase.setAdapter(adapter);
        spinnerPerCase.setSelection(1); // 默认12瓶/箱
        spinnerPerCase.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> p, View v, int pos, long id) { calcAndDisplay(); }
            @Override public void onNothingSelected(AdapterView<?> p) {}
        });
    }

    private void setupInputListeners() {
        TextWatcher watcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override public void afterTextChanged(Editable s) { calcAndDisplay(); }
        };
        etDailySales.addTextChangedListener(watcher);
        etShelfQty.addTextChangedListener(watcher);
        etWarehouseQty.addTextChangedListener(watcher);

        // 加减按钮
        findViewById(R.id.btnAMinus).setOnClickListener(v -> adjustValue(etDailySales, -1, 1));
        findViewById(R.id.btnAPlus).setOnClickListener(v -> adjustValue(etDailySales, 1, 1));
        findViewById(R.id.btnShelfMinus).setOnClickListener(v -> adjustValue(etShelfQty, -5, 0));
        findViewById(R.id.btnShelfPlus).setOnClickListener(v -> adjustValue(etShelfQty, 5, 0));
        findViewById(R.id.btnWarehouseMinus).setOnClickListener(v -> adjustValue(etWarehouseQty, -1, 0));
        findViewById(R.id.btnWarehousePlus).setOnClickListener(v -> adjustValue(etWarehouseQty, 1, 0));
    }

    private void adjustValue(EditText et, int delta, int min) {
        try {
            int current = Integer.parseInt(et.getText().toString());
            et.setText(String.valueOf(Math.max(min, current + delta)));
        } catch (NumberFormatException e) {
            et.setText(String.valueOf(Math.max(min, 0)));
        }
    }

    private void setupPhotoButton() {
        btnTakePhoto.setOnClickListener(v -> {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_PERMISSION);
            } else {
                launchCamera();
            }
        });
        btnRedoPhoto.setOnClickListener(v -> {
            ivPhoto.setVisibility(View.GONE);
            btnRedoPhoto.setVisibility(View.GONE);
            btnTakePhoto.setVisibility(View.VISIBLE);
            photoUri = null;
        });
    }

    private void launchCamera() {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getPackageManager()) != null) {
            startActivityForResult(intent, REQUEST_CAMERA);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CAMERA && resultCode == RESULT_OK && data != null) {
            Bitmap photo = (Bitmap) data.getExtras().get("data");
            ivPhoto.setImageBitmap(photo);
            ivPhoto.setVisibility(View.VISIBLE);
            btnRedoPhoto.setVisibility(View.VISIBLE);
            btnTakePhoto.setVisibility(View.GONE);
            // TODO: 上传照片到服务器，获取URL
        }
    }

    private void setupSubmitButton() {
        // TODO: 绑定底部固定布局中的提交按钮
    }

    // ── 核心：调用心跳公式计算并更新UI ──
    private void calcAndDisplay() {
        try {
            float dailySales = Float.parseFloat(etDailySales.getText().toString());
            int shelf = Integer.parseInt(etShelfQty.getText().toString());
            int warehouse = Integer.parseInt(etWarehouseQty.getText().toString());
            int perCase = PER_CASE_OPTIONS[spinnerPerCase.getSelectedItemPosition()];

            // 仓库换算显示
            tvWarehouseBottles.setText("= " + (warehouse * perCase) + "瓶");

            if (shelf == 0 && warehouse == 0) {
                showEmptyState();
                return;
            }

            // 调用心跳公式
            lastResult = HeartbeatCalculator.calculate(dailySales, selectedGrade, shelf, warehouse, perCase);

            // 更新水位显示
            updateWaterLevelUI(lastResult);

        } catch (NumberFormatException e) {
            showEmptyState();
        }
    }

    private void updateWaterLevelUI(HeartbeatCalculator.Result r) {
        tvWaterLevel.setText(String.format("%.2f", r.waterLevel));
        tvWaterSub.setText(String.format("总库存%d瓶 ÷ a值%.0f瓶 = %.2fa",
            r.totalBottles, r.heartbeatUnit, r.waterLevel));
        tvFormula.setText(r.formulaDetail);
        tvAdvice.setVisibility(View.VISIBLE);
        tvAdvice.setText(r.advice);

        // 根据状态设置颜色
        String color, badgeText;
        switch (r.status) {
            case SAFE:
                color = "#4ADE80"; badgeText = "✅ 安全水位";
                tvAdvice.setBackgroundColor(Color.parseColor("#0A1A0A"));
                break;
            case NORMAL:
                color = "#4ADE80"; badgeText = "🟡 接近预警";
                tvAdvice.setBackgroundColor(Color.parseColor("#0A1A0A"));
                break;
            case WARNING:
                color = "#F5A623"; badgeText = "⚠️ 补货预警";
                tvAdvice.setBackgroundColor(Color.parseColor("#1A1200"));
                break;
            case DANGER:
            default:
                color = "#FF5F5F"; badgeText = "🔴 危险缺货";
                tvAdvice.setBackgroundColor(Color.parseColor("#1A0000"));
                break;
        }
        tvWaterLevel.setTextColor(Color.parseColor(color));
        tvWaterBadge.setText(badgeText);
        tvWaterBadge.setTextColor(Color.parseColor(color));
    }

    private void showEmptyState() {
        tvWaterLevel.setText("—");
        tvWaterLevel.setTextColor(Color.parseColor("#3E4A60"));
        tvWaterBadge.setText("等待录入");
        tvWaterSub.setText("请填写货架和仓库数量");
        tvFormula.setText("录入数据后显示计算过程");
        tvAdvice.setVisibility(View.GONE);
        lastResult = null;
    }

    // ── 提交上报 ──
    public void submitReport(View view) {
        String storeName = etStoreName.getText().toString().trim();
        if (storeName.isEmpty()) {
            Toast.makeText(this, "请填写门店名称", Toast.LENGTH_SHORT).show();
            return;
        }
        if (lastResult == null) {
            Toast.makeText(this, "请填写库存数量", Toast.LENGTH_SHORT).show();
            return;
        }

        // 构建上报数据
        InventoryReport report = new InventoryReport();
        report.storeName = storeName;
        report.storeGrade = selectedGrade;
        report.sku = selectedSKU;
        report.shelfBottles = lastResult.shelfBottles;
        report.warehouseBottles = lastResult.warehouseBottles;
        report.totalBottles = lastResult.totalBottles;
        report.heartbeatUnit = lastResult.heartbeatUnit;
        report.waterLevel = lastResult.waterLevel;
        report.waterStatus = lastResult.status.name();
        report.flagA = cbFlagA.isChecked();
        report.flagB = cbFlagB.isChecked();
        report.flagC = cbFlagC.isChecked();
        report.note = etNote.getText().toString();
        report.reportTime = System.currentTimeMillis();
        // TODO: 加入当前登录用户信息
        // report.userId = UserSession.getCurrentUserId();
        // report.userName = UserSession.getCurrentUserName();
        // TODO: 加入照片URL
        // report.photoUrl = uploadedPhotoUrl;

        // ══════════════════════════════════════════════
        // TODO: 替换为你们SFA的API调用
        // ApiClient.post("/api/inventory/report", report, new Callback() {
        //     @Override public void onSuccess() { showSuccess(); }
        //     @Override public void onError(String msg) { Toast.makeText(...).show(); }
        // });
        // ══════════════════════════════════════════════

        // 临时：本地显示成功
        showSuccess(report);
    }

    private void showSuccess(InventoryReport report) {
        String msg = String.format("✅ 上报成功\n%s · %s\n水位 %.2fa · %s",
            report.storeName, report.storeGrade,
            report.waterLevel, report.waterStatus);
        new android.app.AlertDialog.Builder(this)
            .setMessage(msg)
            .setPositiveButton("继续上报", (d, w) -> resetForm())
            .setNegativeButton("返回", (d, w) -> finish())
            .show();
    }

    private void resetForm() {
        etStoreName.setText("");
        etShelfQty.setText("0");
        etWarehouseQty.setText("0");
        etNote.setText("");
        cbFlagA.setChecked(false);
        cbFlagB.setChecked(false);
        cbFlagC.setChecked(false);
        photoUri = null;
        ivPhoto.setVisibility(View.GONE);
        btnTakePhoto.setVisibility(View.VISIBLE);
        btnRedoPhoto.setVisibility(View.GONE);
        showEmptyState();
    }

    // 处理从其他页面传入的门店信息
    private void handleIntentData() {
        Intent intent = getIntent();
        if (intent != null) {
            String storeId = intent.getStringExtra("storeId");
            String storeName = intent.getStringExtra("storeName");
            String storeGrade = intent.getStringExtra("storeGrade");
            if (storeName != null) etStoreName.setText(storeName);
            if (storeGrade != null) {
                selectedGrade = storeGrade;
                // TODO: 更新等级按钮高亮
            }
            // TODO: 用storeId查询历史a值
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CAMERA_PERMISSION
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            launchCamera();
        }
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == android.R.id.home) { finish(); return true; }
        return super.onOptionsItemSelected(item);
    }

    // ── 数据Model ──
    public static class InventoryReport {
        public String storeName, storeGrade, sku, waterStatus, note;
        public String userId, userName, photoUrl;
        public int shelfBottles, warehouseBottles, totalBottles;
        public float heartbeatUnit, waterLevel;
        public boolean flagA, flagB, flagC;
        public long reportTime;
    }
}
